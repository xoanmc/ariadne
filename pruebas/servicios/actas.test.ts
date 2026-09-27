import type Database from 'better-sqlite3'
import { beforeEach, describe, expect, it } from 'vitest'
import type { DatosActa } from '../../src/compartido/ipc'
import { actasDeCurso, corregirActa, registrarActa } from '../../src/main/servicios/actas'
import { darDeAlta } from '../../src/main/servicios/alumnos'
import { abrirCurso } from '../../src/main/servicios/cursos'
import { crearBaseDePrueba } from '../ayudas/baseDePrueba'

const HOY = '2026-09-27'

let db: Database.Database

function alumnoConCurso(nombre: string): number {
  const alta = darDeAlta(db, { nombre, apellidos: 'García', fechaNacimiento: null, diagnosticos: null, notas: null }, true, HOY)
  if (alta.tipo !== 'creado') throw new Error('alta fallida')
  const curso = abrirCurso(db, alta.alumno.id, {
    curso: '2026/2027',
    nivelEducativo: null,
    periodos: [
      { numero: 1, fechaInicio: '2026-09-10', fechaFin: '2026-12-22' },
      { numero: 2, fechaInicio: '2027-01-08', fechaFin: '2027-03-26' },
      { numero: 3, fechaInicio: '2027-04-06', fechaFin: '2027-06-23' }
    ]
  })
  if (curso.tipo !== 'guardado') throw new Error('apertura fallida')
  return curso.curso.id
}

function acta(fecha: string, extra: Partial<DatosActa> = {}): DatosActa {
  return { fecha, asistentes: 'Madre, tutora y orientadora', contenido: 'Se revisa la adaptación.', acuerdos: null, ...extra }
}

let cursoLucia: number

beforeEach(() => {
  db = crearBaseDePrueba()
  cursoLucia = alumnoConCurso('Lucía')
})

describe('actas de reunión', () => {
  it('se registra un acta y se consulta asociada a su curso', () => {
    const resultado = registrarActa(db, cursoLucia, acta('2026-09-25', { acuerdos: 'Revisar en diciembre.' }), HOY)

    expect(resultado.tipo).toBe('guardada')
    expect(actasDeCurso(db, cursoLucia)).toEqual([
      expect.objectContaining({
        fecha: '2026-09-25',
        asistentes: 'Madre, tutora y orientadora',
        contenido: 'Se revisa la adaptación.',
        acuerdos: 'Revisar en diciembre.'
      })
    ])
  })

  it('un curso tiene varias, de la más reciente a la más antigua', () => {
    registrarActa(db, cursoLucia, acta('2026-09-15'), HOY)
    registrarActa(db, cursoLucia, acta('2026-09-25'), HOY)
    registrarActa(db, cursoLucia, acta('2026-09-20'), HOY)

    expect(actasDeCurso(db, cursoLucia).map((a) => a.fecha)).toEqual(['2026-09-25', '2026-09-20', '2026-09-15'])
  })

  it('las actas de un alumno nunca aparecen en el curso de otro', () => {
    const cursoMario = alumnoConCurso('Mario')
    registrarActa(db, cursoLucia, acta('2026-09-25', { contenido: 'Reunión sobre Lucía' }), HOY)
    registrarActa(db, cursoMario, acta('2026-09-26', { contenido: 'Reunión sobre Mario' }), HOY)

    expect(actasDeCurso(db, cursoLucia).map((a) => a.contenido)).toEqual(['Reunión sobre Lucía'])
    expect(actasDeCurso(db, cursoMario).map((a) => a.contenido)).toEqual(['Reunión sobre Mario'])
  })

  it('con datos incompletos no se guarda nada', () => {
    const resultado = registrarActa(db, cursoLucia, acta('2026-09-25', { contenido: '', acuerdos: '' }), HOY)

    expect(resultado.tipo).toBe('invalida')
    expect(actasDeCurso(db, cursoLucia)).toEqual([])
  })

  it('se puede corregir un acta', () => {
    const creada = registrarActa(db, cursoLucia, acta('2026-09-25'), HOY)
    if (creada.tipo !== 'guardada') throw new Error('registro fallido')

    const resultado = corregirActa(db, creada.acta.id, acta('2026-09-24', { acuerdos: 'Añadido después' }), HOY)

    expect(resultado.tipo === 'guardada' && resultado.acta).toMatchObject({ fecha: '2026-09-24', acuerdos: 'Añadido después' })
    expect(actasDeCurso(db, cursoLucia)).toHaveLength(1)
  })

  it('en un curso cerrado no se registran ni se corrigen', () => {
    const creada = registrarActa(db, cursoLucia, acta('2026-09-25'), HOY)
    if (creada.tipo !== 'guardada') throw new Error('registro fallido')
    db.prepare("UPDATE curso_academico SET estado = 'cerrado' WHERE id = ?").run(cursoLucia)

    const mensaje = 'El curso 2026/2027 está cerrado y sus actas ya no cambian.'
    expect(registrarActa(db, cursoLucia, acta('2026-09-26'), HOY)).toEqual({ tipo: 'rechazada', mensaje })
    expect(corregirActa(db, creada.acta.id, acta('2026-09-26'), HOY)).toEqual({ tipo: 'rechazada', mensaje })
    expect(actasDeCurso(db, cursoLucia)).toHaveLength(1)
  })

  it('un curso o un acta que no existen se dicen claramente', () => {
    expect(registrarActa(db, 999, acta('2026-09-25'), HOY)).toEqual({ tipo: 'rechazada', mensaje: 'Este curso no existe.' })
    expect(corregirActa(db, 999, acta('2026-09-25'), HOY)).toEqual({ tipo: 'rechazada', mensaje: 'Esta acta no existe.' })
    expect(actasDeCurso(db, 'uno')).toEqual([])
  })
})
