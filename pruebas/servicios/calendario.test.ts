import type Database from 'better-sqlite3'
import { beforeEach, describe, expect, it } from 'vitest'
import type { PeriodoTrimestre } from '../../src/compartido/ipc'
import { darDeAlta } from '../../src/main/servicios/alumnos'
import { guardarCalendario, listarCalendarios } from '../../src/main/servicios/calendario'
import { abrirCurso, obtenerCurso } from '../../src/main/servicios/cursos'
import { registrarSesion } from '../../src/main/servicios/sesiones'
import { crearBaseDePrueba } from '../ayudas/baseDePrueba'

const HOY = '2026-10-14'
const CURSO = '2026/2027'

const CALENDARIO: PeriodoTrimestre[] = [
  { numero: 1, fechaInicio: '2026-09-10', fechaFin: '2026-12-22' },
  { numero: 2, fechaInicio: '2027-01-08', fechaFin: '2027-03-26' },
  { numero: 3, fechaInicio: '2027-04-06', fechaFin: '2027-06-23' }
]

let db: Database.Database

function alumnoConCurso(nombre: string): number {
  const alta = darDeAlta(db, { nombre, apellidos: 'García', fechaNacimiento: null, diagnosticos: null, notas: null }, true, HOY)
  if (alta.tipo !== 'creado') throw new Error('alta fallida')
  const r = abrirCurso(db, alta.alumno.id, { curso: CURSO, nivelEducativo: null })
  if (r.tipo !== 'guardado') throw new Error('apertura fallida')
  return r.curso.id
}

const fechas = (cursoId: number) => obtenerCurso(db, cursoId, HOY)!.trimestres.map(({ numero, fechaInicio, fechaFin }) => ({ numero, fechaInicio, fechaFin }))
const con = (numero: 1 | 2 | 3, cambios: Partial<PeriodoTrimestre>) => CALENDARIO.map((p) => (p.numero === numero ? { ...p, ...cambios } : p))

beforeEach(() => {
  db = crearBaseDePrueba()
  guardarCalendario(db, CURSO, CALENDARIO)
})

describe('calendario escolar común', () => {
  it('todos los alumnos que abren ese curso toman sus fechas', () => {
    const lucia = alumnoConCurso('Lucía')
    const mario = alumnoConCurso('Mario')
    expect(fechas(lucia)).toEqual(CALENDARIO)
    expect(fechas(mario)).toEqual(CALENDARIO)
  })

  it('cambiar el calendario cambia las fechas de todos a la vez', () => {
    const lucia = alumnoConCurso('Lucía')
    const mario = alumnoConCurso('Mario')
    const nuevas = con(1, { fechaFin: '2026-12-19' })

    expect(guardarCalendario(db, CURSO, nuevas).tipo).toBe('guardado')
    expect(fechas(lucia)).toEqual(nuevas)
    expect(fechas(mario)).toEqual(nuevas)
  })

  it('valida las fechas como siempre: sin solapes y en los años del curso', () => {
    const r = guardarCalendario(db, CURSO, con(2, { fechaInicio: '2026-12-01' }))
    expect(r.tipo).toBe('invalido')
    expect(guardarCalendario(db, CURSO, con(3, { fechaFin: '2072-06-23' })).tipo).toBe('invalido')
    expect(guardarCalendario(db, '2026/2028', CALENDARIO)).toEqual({ tipo: 'rechazado', mensaje: 'Ese curso escolar no es válido.' })
  })

  it('un trimestre cerrado para algún alumno ya no cambia de fechas, pero los demás sí', () => {
    const lucia = alumnoConCurso('Lucía')
    db.prepare("UPDATE trimestre SET estado = 'cerrado' WHERE curso_academico_id = ? AND numero = 1").run(lucia)

    expect(guardarCalendario(db, CURSO, con(1, { fechaFin: '2026-12-19' }))).toEqual({
      tipo: 'rechazado',
      mensaje: 'No se puede guardar. El 1.er trimestre ya está cerrado para Lucía García: sus fechas ya no cambian.'
    })
    expect(guardarCalendario(db, CURSO, con(3, { fechaFin: '2027-06-19' })).tipo).toBe('guardado')
    expect(listarCalendarios(db, HOY).find((c) => c.curso === CURSO)!.cerrados).toEqual([1])
  })

  it('no acepta fechas que dejen una sesión fuera de su trimestre', () => {
    const lucia = alumnoConCurso('Lucía')
    const alumnoId = obtenerCurso(db, lucia, HOY)!.alumnoId
    registrarSesion(db, alumnoId, { fecha: '2026-09-15', objetivos: [], estadoAlumno: ['Tranquilo'], respuestaActividades: [], observaciones: null, saludMedicacion: null, falta: false }, HOY)

    expect(guardarCalendario(db, CURSO, con(1, { fechaInicio: '2026-09-20' }))).toEqual({
      tipo: 'rechazado',
      mensaje: 'No se puede guardar. Lucía García tiene una sesión que quedaría fuera de su trimestre.'
    })
    expect(fechas(lucia)).toEqual(CALENDARIO)
  })

  it('lista el curso que toca aunque aún no esté fijado, con las fechas propuestas', () => {
    const calendarios = listarCalendarios(db, '2027-09-05')
    expect(calendarios.map((c) => [c.curso, c.fijado])).toEqual([
      ['2027/2028', false],
      ['2026/2027', true]
    ])
    expect(calendarios[0].periodos[0]).toEqual({ numero: 1, fechaInicio: '2027-09-01', fechaFin: '2027-12-31' })
  })

  it('cuenta los alumnos que tienen ese curso', () => {
    alumnoConCurso('Lucía')
    alumnoConCurso('Mario')
    expect(listarCalendarios(db, HOY)[0]).toMatchObject({ curso: CURSO, alumnos: 2, conFechasPropias: [], pendientesDeAjustar: 0 })
  })
})

describe('alumnos con fechas propias (de antes del calendario común)', () => {
  it('si se pueden ajustar sin descolocar nada, se ajustan al guardar', () => {
    const lucia = alumnoConCurso('Lucía')
    db.prepare("UPDATE trimestre SET fecha_fin = '2026-12-20' WHERE curso_academico_id = ? AND numero = 1").run(lucia)
    expect(listarCalendarios(db, HOY)[0].pendientesDeAjustar).toBe(1)

    guardarCalendario(db, CURSO, CALENDARIO)
    expect(fechas(lucia)).toEqual(CALENDARIO)
  })

  it('si no, conservan sus fechas, no impiden guardar y se dice por qué', () => {
    const lucia = alumnoConCurso('Lucía')
    db.prepare("UPDATE trimestre SET fecha_fin = '2026-12-31', estado = 'cerrado' WHERE curso_academico_id = ? AND numero = 1").run(lucia)

    expect(guardarCalendario(db, CURSO, con(3, { fechaFin: '2027-06-19' })).tipo).toBe('guardado')
    expect(fechas(lucia)[0].fechaFin).toBe('2026-12-31')
    expect(listarCalendarios(db, HOY)[0].conFechasPropias).toEqual([
      { alumno: 'Lucía García', motivo: 'Tiene cerrado el 1.er trimestre con otras fechas.' }
    ])
  })
})
