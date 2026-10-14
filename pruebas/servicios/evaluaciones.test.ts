import type Database from 'better-sqlite3'
import { beforeEach, describe, expect, it } from 'vitest'
import { darDeAlta } from '../../src/main/servicios/alumnos'
import { evaluacionDeCurso, guardarEvaluacion, sugerenciasDeInstrumento } from '../../src/main/servicios/evaluaciones'
import { crearBaseDePrueba } from '../ayudas/baseDePrueba'
import { abrirCursoDePrueba } from '../ayudas/cursoDePrueba'

const HOY = '2026-09-27'

let db: Database.Database
let cursoId: number

beforeEach(() => {
  db = crearBaseDePrueba()
  const alta = darDeAlta(db, { nombre: 'Lucía', apellidos: 'García', fechaNacimiento: null, diagnosticos: null, notas: null }, false, HOY)
  if (alta.tipo !== 'creado') throw new Error('alta fallida')
  const curso = abrirCursoDePrueba(db, alta.alumno.id, {
    curso: '2026/2027',
    nivelEducativo: null,
    periodos: [
      { numero: 1, fechaInicio: '2026-09-10', fechaFin: '2026-12-22' },
      { numero: 2, fechaInicio: '2027-01-08', fechaFin: '2027-03-26' },
      { numero: 3, fechaInicio: '2027-04-06', fechaFin: '2027-06-23' }
    ]
  })
  if (curso.tipo !== 'guardado') throw new Error('apertura fallida')
  cursoId = curso.curso.id
})

describe('evaluación inicial', () => {
  it('se registra y se consulta asociada a su curso', () => {
    expect(evaluacionDeCurso(db, cursoId)).toBeNull()

    const resultado = guardarEvaluacion(
      db,
      cursoId,
      { fecha: '2026-09-18', instrumento: 'Diverlexia', contenido: 'Lectura silábica, lenta.' },
      HOY
    )

    expect(resultado.tipo).toBe('guardada')
    expect(evaluacionDeCurso(db, cursoId)).toMatchObject({
      fecha: '2026-09-18',
      instrumento: 'Diverlexia',
      contenido: 'Lectura silábica, lenta.'
    })
  })

  it('volver a guardarla la corrige en lugar de crear otra', () => {
    guardarEvaluacion(db, cursoId, { fecha: '2026-09-18', instrumento: null, contenido: 'Primera versión' }, HOY)
    guardarEvaluacion(db, cursoId, { fecha: '2026-09-19', instrumento: 'Prolexia', contenido: 'Corregida' }, HOY)

    expect(db.prepare('SELECT COUNT(*) AS n FROM evaluacion_inicial').get()).toEqual({ n: 1 })
    expect(evaluacionDeCurso(db, cursoId)).toMatchObject({ fecha: '2026-09-19', contenido: 'Corregida' })
  })

  it('con datos incompletos no guarda nada', () => {
    const resultado = guardarEvaluacion(db, cursoId, { fecha: '2026-09-18', instrumento: null, contenido: '' }, HOY)

    expect(resultado.tipo).toBe('invalida')
    expect(evaluacionDeCurso(db, cursoId)).toBeNull()
  })

  it('en un curso cerrado ya no cambia', () => {
    guardarEvaluacion(db, cursoId, { fecha: '2026-09-18', instrumento: null, contenido: 'Original' }, HOY)
    db.prepare("UPDATE curso_academico SET estado = 'cerrado' WHERE id = ?").run(cursoId)

    const resultado = guardarEvaluacion(db, cursoId, { fecha: '2026-09-18', instrumento: null, contenido: 'Cambiada' }, HOY)

    expect(resultado).toEqual({ tipo: 'rechazada', mensaje: 'El curso 2026/2027 está cerrado y su evaluación inicial ya no cambia.' })
    expect(evaluacionDeCurso(db, cursoId)?.contenido).toBe('Original')
  })

  it('un curso que no existe se dice claramente', () => {
    expect(guardarEvaluacion(db, 999, { fecha: '2026-09-18', instrumento: null, contenido: 'x' }, HOY)).toEqual({
      tipo: 'rechazada',
      mensaje: 'Este curso no existe.'
    })
    expect(evaluacionDeCurso(db, 'uno')).toBeNull()
  })

  it('los instrumentos que ya usó aparecen como sugerencia', () => {
    guardarEvaluacion(db, cursoId, { fecha: '2026-09-18', instrumento: 'WISC-V', contenido: 'x' }, HOY)
    expect(sugerenciasDeInstrumento(db)).toEqual(['Diverlexia', 'Prolexia', 'WISC-V'])
  })
})
