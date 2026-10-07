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

export interface SesionGuardada extends NuevaSesion {
  id: number
}

const COLUMNAS = `id, alumno_id AS alumnoId, trimestre_id AS trimestreId, fecha, estado_alumno AS estadoAlumno,
  respuesta_actividades AS respuestaActividades, observaciones, incidencias, salud_medicacion AS saludMedicacion`

export function obtenerSesion(db: BaseDatos, id: number): SesionGuardada | null {
  return (db.prepare(`SELECT ${COLUMNAS} FROM sesion WHERE id = ?`).get(id) as SesionGuardada | undefined) ?? null
}

/** En orden cronológico, como el diario que llevaba. */
export function sesionesDeCurso(db: BaseDatos, cursoId: number): SesionGuardada[] {
  return db
    .prepare(
      `SELECT ${COLUMNAS} FROM sesion
       WHERE trimestre_id IN (SELECT id FROM trimestre WHERE curso_academico_id = ?)
       ORDER BY fecha, id`
    )
    .all(cursoId) as SesionGuardada[]
}

export function objetivosDeSesion(db: BaseDatos, sesionId: number): { objetivoId: number; enunciado: string }[] {
  return db
    .prepare(
      `SELECT o.id AS objetivoId, o.enunciado FROM sesion_objetivo so JOIN objetivo o ON o.id = so.objetivo_id
       WHERE so.sesion_id = ? ORDER BY o.id`
    )
    .all(sesionId) as { objetivoId: number; enunciado: string }[]
}

export function actualizarSesion(db: BaseDatos, id: number, sesion: NuevaSesion): void {
  db.prepare(
    `UPDATE sesion SET alumno_id = @alumnoId, trimestre_id = @trimestreId, fecha = @fecha, estado_alumno = @estadoAlumno,
       respuesta_actividades = @respuestaActividades, observaciones = @observaciones, incidencias = @incidencias,
       salud_medicacion = @saludMedicacion
     WHERE id = @id`
  ).run({ id, ...sesion })
  db.prepare('DELETE FROM sesion_objetivo WHERE sesion_id = ?').run(id)
}

/** Sus objetivos trabajados se van con ella (ON DELETE CASCADE). */
export function borrarSesion(db: BaseDatos, id: number): void {
  db.prepare('DELETE FROM sesion WHERE id = ?').run(id)
}
