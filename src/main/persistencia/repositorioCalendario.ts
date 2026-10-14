import type { PeriodoTrimestre } from '../dominio/calendario'
import type { NumeroTrimestre } from '../dominio/entidades'
import type { BaseDatos } from './baseDatos'

const PERIODOS = 'SELECT numero, fecha_inicio AS fechaInicio, fecha_fin AS fechaFin FROM calendario_trimestre WHERE curso = ? ORDER BY numero'

/** Las fechas de los tres trimestres de un curso escolar, o null si todavía no se han fijado. */
export function calendarioDe(db: BaseDatos, curso: string): PeriodoTrimestre[] | null {
  const filas = db.prepare(PERIODOS).all(curso) as PeriodoTrimestre[]
  return filas.length === 0 ? null : filas
}

/** Los cursos escolares con calendario, del más reciente al más antiguo. */
export function cursosConCalendario(db: BaseDatos): string[] {
  return (db.prepare('SELECT DISTINCT curso FROM calendario_trimestre ORDER BY curso DESC').all() as { curso: string }[]).map((f) => f.curso)
}

export function guardarPeriodos(db: BaseDatos, curso: string, periodos: readonly PeriodoTrimestre[]): void {
  const guardar = db.prepare(
    `INSERT INTO calendario_trimestre (curso, numero, fecha_inicio, fecha_fin) VALUES (?, ?, ?, ?)
     ON CONFLICT (curso, numero) DO UPDATE SET fecha_inicio = excluded.fecha_inicio, fecha_fin = excluded.fecha_fin`
  )
  periodos.forEach((p) => guardar.run(curso, p.numero, p.fechaInicio, p.fechaFin))
}

export interface TrimestreDeAlumno {
  trimestreId: number
  cursoAcademicoId: number
  alumno: string
  numero: NumeroTrimestre
  fechaInicio: string
  fechaFin: string
  estado: 'abierto' | 'cerrado'
}

/** Los trimestres de todos los alumnos en ese curso escolar. */
export function trimestresDelCursoEscolar(db: BaseDatos, curso: string): TrimestreDeAlumno[] {
  return db
    .prepare(
      `SELECT t.id AS trimestreId, ca.id AS cursoAcademicoId, a.nombre || ' ' || a.apellidos AS alumno, t.numero,
              t.fecha_inicio AS fechaInicio, t.fecha_fin AS fechaFin, t.estado
       FROM trimestre t
       JOIN curso_academico ca ON ca.id = t.curso_academico_id
       JOIN alumno a ON a.id = ca.alumno_id
       WHERE ca.curso = ?
       ORDER BY a.apellidos, a.nombre, t.numero`
    )
    .all(curso) as TrimestreDeAlumno[]
}

/** Las sesiones de todos los alumnos en ese curso escolar, con el trimestre en el que están. */
export function sesionesDelCursoEscolar(
  db: BaseDatos,
  curso: string
): { cursoAcademicoId: number; alumno: string; numero: NumeroTrimestre; fecha: string }[] {
  return db
    .prepare(
      `SELECT ca.id AS cursoAcademicoId, a.nombre || ' ' || a.apellidos AS alumno, t.numero, s.fecha
       FROM sesion s
       JOIN trimestre t ON t.id = s.trimestre_id
       JOIN curso_academico ca ON ca.id = t.curso_academico_id
       JOIN alumno a ON a.id = ca.alumno_id
       WHERE ca.curso = ?`
    )
    .all(curso) as { cursoAcademicoId: number; alumno: string; numero: NumeroTrimestre; fecha: string }[]
}
