import type Database from 'better-sqlite3'
import { beforeEach, describe, expect, it } from 'vitest'
import type { VistaCurso } from '../../src/compartido/ipc'
import { darDeAlta } from '../../src/main/servicios/alumnos'
import { abrirCurso } from '../../src/main/servicios/cursos'
import { anadirObjetivo, crearPrograma, editarContenido, programaDeCurso } from '../../src/main/servicios/programas'
import { crearBaseDePrueba } from '../ayudas/baseDePrueba'

const HOY = '2026-09-27'

let db: Database.Database
let curso: VistaCurso

function nuevoCurso(nombre: string): VistaCurso {
  const alta = darDeAlta(db, { nombre, apellidos: 'García', fechaNacimiento: null, diagnosticos: null, notas: null }, true, HOY)
  if (alta.tipo !== 'creado') throw new Error('alta fallida')
  const abierto = abrirCurso(db, alta.alumno.id, {
    curso: '2026/2027',
    nivelEducativo: null,
    periodos: [
      { numero: 1, fechaInicio: '2026-09-10', fechaFin: '2026-12-22' },
      { numero: 2, fechaInicio: '2027-01-08', fechaFin: '2027-03-26' },
      { numero: 3, fechaInicio: '2027-04-06', fechaFin: '2027-06-23' }
    ]
  })
  if (abierto.tipo !== 'guardado') throw new Error('apertura fallida')
  return abierto.curso
}

function trimestre(numero: 1 | 2 | 3, de = curso): number {
  return de.trimestres.find((t) => t.numero === numero)!.id
}

function programa(contenido: string | null = null) {
  const resultado = crearPrograma(db, curso.id, contenido, HOY)
  if (resultado.tipo !== 'guardado') throw new Error(`creación fallida: ${JSON.stringify(resultado)}`)
  return resultado.programa
}

beforeEach(() => {
  db = crearBaseDePrueba()
  curso = nuevoCurso('Lucía')
})

describe('programa de intervención', () => {
  it('se crea un programa, se añaden objetivos y cada uno queda en un trimestre sin valorar', () => {
    const creado = programa('Trabajar lectoescritura y atención.')
    anadirObjetivo(db, creado.id, { enunciado: 'Mejorar la fluidez lectora', trimestreId: trimestre(1) }, HOY)
    anadirObjetivo(db, creado.id, { enunciado: 'Mantener la atención 15 minutos', trimestreId: trimestre(2) }, HOY)

    const visto = programaDeCurso(db, curso.id)!
    expect(visto.contenido).toBe('Trabajar lectoescritura y atención.')
    expect(visto.asignaciones.map((a) => [a.enunciado, a.numeroTrimestre, a.valoracion, a.etiquetaValoracion, a.arrastrado])).toEqual([
      ['Mejorar la fluidez lectora', 1, 'sin_valorar', 'sin valorar', false],
      ['Mantener la atención 15 minutos', 2, 'sin_valorar', 'sin valorar', false]
    ])
  })

  it('un curso tiene un solo programa', () => {
    programa()
    expect(crearPrograma(db, curso.id, null, HOY)).toEqual({
      tipo: 'rechazado',
      mensaje: 'El curso 2026/2027 ya tiene programa de intervención.'
    })
  })

  it('el contenido general es opcional', () => {
    expect(programa().contenido).toBeNull()
  })

  it('la fecha de revisión se actualiza al cambiar el contenido o añadir un objetivo', () => {
    const creado = programa()
    expect(creado.fechaRevision).toBeNull()

    editarContenido(db, creado.id, 'Nuevo enfoque', '2026-10-05')
    expect(programaDeCurso(db, curso.id)!.fechaRevision).toBe('2026-10-05')

    anadirObjetivo(db, creado.id, { enunciado: 'Objetivo', trimestreId: trimestre(1) }, '2026-10-20')
    expect(programaDeCurso(db, curso.id)!.fechaRevision).toBe('2026-10-20')
  })
})

describe('añadir objetivos', () => {
  it('exige el enunciado', () => {
    const creado = programa()
    const resultado = anadirObjetivo(db, creado.id, { enunciado: '  ', trimestreId: trimestre(1) }, HOY)

    expect(resultado.tipo === 'invalido' && resultado.problemas.map((p) => p.campo)).toEqual(['enunciado'])
    expect(programaDeCurso(db, curso.id)!.asignaciones).toEqual([])
  })

  it('no admite un trimestre cerrado', () => {
    const creado = programa()
    db.prepare("UPDATE trimestre SET estado = 'cerrado' WHERE id = ?").run(trimestre(1))

    const resultado = anadirObjetivo(db, creado.id, { enunciado: 'Objetivo', trimestreId: trimestre(1) }, HOY)
    expect(resultado.tipo === 'invalido' && resultado.problemas[0].mensaje).toMatch(/está cerrado/)
  })

  it('no admite un trimestre de otro curso', () => {
    const creado = programa()
    const otro = nuevoCurso('Mario')

    const resultado = anadirObjetivo(db, creado.id, { enunciado: 'Objetivo', trimestreId: trimestre(1, otro) }, HOY)
    expect(resultado.tipo === 'invalido' && resultado.problemas[0].campo).toBe('trimestre')
  })

  it('se pueden planificar objetivos para trimestres futuros', () => {
    const creado = programa()
    expect(anadirObjetivo(db, creado.id, { enunciado: 'Objetivo', trimestreId: trimestre(3) }, HOY).tipo).toBe('guardado')
  })
})

describe('curso cerrado', () => {
  it('su programa se consulta, pero ya no cambia', () => {
    const creado = programa('Original')
    anadirObjetivo(db, creado.id, { enunciado: 'Objetivo', trimestreId: trimestre(1) }, HOY)
    db.prepare("UPDATE curso_academico SET estado = 'cerrado' WHERE id = ?").run(curso.id)

    const mensaje = 'El curso 2026/2027 está cerrado y su programa ya no cambia.'
    expect(editarContenido(db, creado.id, 'Cambiado', HOY)).toEqual({ tipo: 'rechazado', mensaje })
    expect(anadirObjetivo(db, creado.id, { enunciado: 'Otro', trimestreId: trimestre(2) }, HOY)).toEqual({ tipo: 'rechazado', mensaje })
    expect(programaDeCurso(db, curso.id)).toMatchObject({ contenido: 'Original' })
    expect(programaDeCurso(db, curso.id)!.asignaciones).toHaveLength(1)
  })

  it('en un curso cerrado no se crea programa', () => {
    db.prepare("UPDATE curso_academico SET estado = 'cerrado' WHERE id = ?").run(curso.id)
    expect(crearPrograma(db, curso.id, null, HOY).tipo).toBe('rechazado')
  })
})

describe('casos raros', () => {
  it('un curso o un programa que no existen se dicen claramente', () => {
    expect(crearPrograma(db, 999, null, HOY)).toEqual({ tipo: 'rechazado', mensaje: 'Este curso no existe.' })
    expect(anadirObjetivo(db, 999, { enunciado: 'x', trimestreId: 1 }, HOY)).toEqual({
      tipo: 'rechazado',
      mensaje: 'Este programa no existe.'
    })
    expect(programaDeCurso(db, 'uno')).toBeNull()
  })
})
