import type { DatosEvaluacion } from '../dominio/evaluacion'
import type { EvaluacionInicial } from '../dominio/entidades'
import type { BaseDatos } from './baseDatos'

interface FilaEvaluacion {
  id: number
  curso_academico_id: number
  fecha: string
  contenido: string
  instrumento: string | null
}

function aEvaluacion(fila: FilaEvaluacion): EvaluacionInicial {
  return {
    id: fila.id,
    cursoAcademicoId: fila.curso_academico_id,
    fecha: fila.fecha,
    contenido: fila.contenido,
    instrumento: fila.instrumento
  }
}

export function evaluacionDeCurso(db: BaseDatos, cursoId: number): EvaluacionInicial | null {
  const fila = db.prepare('SELECT * FROM evaluacion_inicial WHERE curso_academico_id = ?').get(cursoId) as
    | FilaEvaluacion
    | undefined
  return fila ? aEvaluacion(fila) : null
}

/** Una por curso: si ya existe, se sustituye su contenido. */
export function guardarEvaluacion(db: BaseDatos, cursoId: number, datos: DatosEvaluacion): void {
  db.prepare(
    `INSERT INTO evaluacion_inicial (curso_academico_id, fecha, contenido, instrumento)
     VALUES (@cursoId, @fecha, @contenido, @instrumento)
     ON CONFLICT (curso_academico_id) DO UPDATE
       SET fecha = excluded.fecha, contenido = excluded.contenido, instrumento = excluded.instrumento`
  ).run({ cursoId, fecha: datos.fecha, contenido: datos.contenido, instrumento: datos.instrumento })
}

export function instrumentosUsados(db: BaseDatos): string[] {
  const filas = db
    .prepare('SELECT DISTINCT instrumento FROM evaluacion_inicial WHERE instrumento IS NOT NULL')
    .all() as { instrumento: string }[]
  return filas.map((f) => f.instrumento)
}
