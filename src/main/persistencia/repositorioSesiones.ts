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
