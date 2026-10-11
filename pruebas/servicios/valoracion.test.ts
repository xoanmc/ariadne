import type Database from 'better-sqlite3'
import { beforeEach, describe, expect, it } from 'vitest'
import type { VistaCurso } from '../../src/compartido/ipc'
import { darDeAlta } from '../../src/main/servicios/alumnos'
import { valorarObjetivo } from '../../src/main/servicios/cierre'
import { abrirCurso } from '../../src/main/servicios/cursos'
import { anadirObjetivo, crearPrograma, programaDeCurso } from '../../src/main/servicios/programas'
import { registrarSesion } from '../../src/main/servicios/sesiones'
import { crearBaseDePrueba } from '../ayudas/baseDePrueba'

const HOY = '2026-11-15'

let db: Database.Database
let curso: VistaCurso
let alumnoId: number
let asignacion: number

const enElPrograma = () => programaDeCurso(db, curso.id)!.asignaciones.find((a) => a.asignacionId === asignacion)!

beforeEach(() => {
  db = crearBaseDePrueba()
  const alta = darDeAlta(db, { nombre: 'Lucía', apellidos: 'García', fechaNacimiento: null, diagnosticos: null, notas: null }, false, HOY)
  if (alta.tipo !== 'creado') throw new Error('alta fallida')
  alumnoId = alta.alumno.id
  const abierto = abrirCurso(db, alumnoId, {
    curso: '2026/2027',
    nivelEducativo: null,
    periodos: [
      { numero: 1, fechaInicio: '2026-09-10', fechaFin: '2026-12-22' },
      { numero: 2, fechaInicio: '2027-01-08', fechaFin: '2027-03-26' },
      { numero: 3, fechaInicio: '2027-04-06', fechaFin: '2027-06-23' }
    ]
  })
  if (abierto.tipo !== 'guardado') throw new Error('apertura fallida')
  curso = abierto.curso
  const programa = crearPrograma(db, curso.id, null, [], HOY)
  if (programa.tipo !== 'guardado') throw new Error('programa fallido')
  const r = anadirObjetivo(db, programa.programa.id, { enunciado: 'Mejorar la fluidez lectora', trimestreId: curso.trimestres[0].id }, HOY)
  if (r.tipo !== 'guardado') throw new Error('objetivo fallido')
  asignacion = r.programa.asignaciones[0].asignacionId
})

describe('valoración de objetivos (T5.1)', () => {
  it('se valora con uno de sus tres estados y un comentario, y queda registrado', () => {
    expect(valorarObjetivo(db, asignacion, 'no_conseguido', '  Avanza, pero aún silabea  ')).toEqual({
      tipo: 'guardado',
      asignacionId: asignacion,
      valoracion: 'no_conseguido',
      etiquetaValoracion: 'no conseguido',
      comentario: 'Avanza, pero aún silabea'
    })
    expect(enElPrograma()).toMatchObject({ valoracion: 'no_conseguido', comentario: 'Avanza, pero aún silabea' })
  })

  it('se puede cambiar o volver a dejar sin valorar mientras el trimestre siga abierto', () => {
    valorarObjetivo(db, asignacion, 'conseguido', null)
    valorarObjetivo(db, asignacion, 'pendiente_desarrollar', null)
    expect(enElPrograma().valoracion).toBe('pendiente_desarrollar')
    valorarObjetivo(db, asignacion, 'sin_valorar', 'Lo decido al final')
    expect(enElPrograma()).toMatchObject({ valoracion: 'sin_valorar', comentario: 'Lo decido al final' })
  })

  it('un comentario en blanco se guarda como ninguno', () => {
    valorarObjetivo(db, asignacion, 'conseguido', 'Bien')
    valorarObjetivo(db, asignacion, 'conseguido', '   ')
    expect(enElPrograma().comentario).toBeNull()
  })

  it('lo que digan las sesiones no impide valorar: el criterio es suyo', () => {
    const objetivoId = enElPrograma().objetivoId
    registrarSesion(
      db,
      alumnoId,
      { fecha: '2026-11-10', objetivos: [objetivoId], estadoAlumno: ['Tranquilo'], respuestaActividades: [], observaciones: null, saludMedicacion: null, falta: false },
      HOY
    )
    expect(valorarObjetivo(db, asignacion, 'pendiente_desarrollar', null).tipo).toBe('guardado')
  })

  it('en un trimestre cerrado la valoración queda fija', () => {
    valorarObjetivo(db, asignacion, 'conseguido', null)
    db.prepare("UPDATE trimestre SET estado = 'cerrado' WHERE id = ?").run(curso.trimestres[0].id)

    expect(valorarObjetivo(db, asignacion, 'no_conseguido', null)).toEqual({
      tipo: 'rechazado',
      mensaje: 'Ese objetivo es del 1.er trimestre, que ya está cerrado: su valoración no se cambia.'
    })
    expect(enElPrograma().valoracion).toBe('conseguido')
  })

  it('en un curso cerrado tampoco se cambia', () => {
    db.prepare("UPDATE curso_academico SET estado = 'cerrado' WHERE id = ?").run(curso.id)
    expect(valorarObjetivo(db, asignacion, 'conseguido', null).tipo).toBe('rechazado')
  })

  it('una valoración que no es de la rúbrica o un objetivo que no existe se rechazan', () => {
    expect(valorarObjetivo(db, asignacion, 'regular', null)).toEqual({ tipo: 'rechazado', mensaje: 'Elige una valoración.' })
    expect(valorarObjetivo(db, 999, 'conseguido', null)).toEqual({ tipo: 'rechazado', mensaje: 'Ese objetivo no existe.' })
    expect(enElPrograma().valoracion).toBe('sin_valorar')
  })
})
