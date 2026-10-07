import type { BaseDatos } from './baseDatos'

export interface NuevaSesion {
  alumnoId: number
  trimestreId: number
  fecha: string
  estadoAlumno: string | null
  respuestaActividades: string | null
  observaciones: string | null
  incidencias: string | null
  saludMedicacion: string | null
}

export function insertarSesion(db: BaseDatos, sesion: NuevaSesion): number {
  return Number(
    db
      .prepare(
        `INSERT INTO sesion (alumno_id, trimestre_id, fecha, estado_alumno, respuesta_actividades, observaciones, incidencias, salud_medicacion)
         VALUES (@alumnoId, @trimestreId, @fecha, @estadoAlumno, @respuestaActividades, @observaciones, @incidencias, @saludMedicacion)`
      )
      .run(sesion).lastInsertRowid
  )
}

export interface ObjetivoDeTrimestre {
  objetivoId: number
  enunciado: string
  arrastrado: boolean
}

export function objetivosDeTrimestre(db: BaseDatos, trimestreId: number): ObjetivoDeTrimestre[] {
  const filas = db
    .prepare(
      `SELECT o.id AS objetivoId, o.enunciado, a.asignacion_anterior_id IS NOT NULL AS arrastrado
       FROM asignacion_trimestral a JOIN objetivo o ON o.id = a.objetivo_id
       WHERE a.trimestre_id = ? ORDER BY o.id`
    )
    .all(trimestreId) as { objetivoId: number; enunciado: string; arrastrado: number }[]
  return filas.map((f) => ({ ...f, arrastrado: f.arrastrado === 1 }))
}

export function asociarObjetivos(db: BaseDatos, sesionId: number, objetivoIds: readonly number[]): void {
  const insertar = db.prepare('INSERT INTO sesion_objetivo (sesion_id, objetivo_id) VALUES (?, ?)')
  objetivoIds.forEach((id) => insertar.run(sesionId, id))
}
