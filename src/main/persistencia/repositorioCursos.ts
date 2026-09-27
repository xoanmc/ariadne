import type { PeriodoTrimestre } from '../dominio/calendario'
import type { CursoAcademico, Trimestre } from '../dominio/entidades'
import type { BaseDatos } from './baseDatos'

interface FilaCurso {
  id: number
  alumno_id: number
  curso: string
  nivel_educativo: string | null
  estado: CursoAcademico['estado']
  curso_anterior_id: number | null
}

interface FilaTrimestre {
  id: number
  curso_academico_id: number
  numero: Trimestre['numero']
  fecha_inicio: string
  fecha_fin: string
  estado: Trimestre['estado']
}

function aCurso(fila: FilaCurso): CursoAcademico {
  return {
    id: fila.id,
    alumnoId: fila.alumno_id,
    curso: fila.curso,
    nivelEducativo: fila.nivel_educativo,
    estado: fila.estado,
    cursoAnteriorId: fila.curso_anterior_id
  }
}

function aTrimestre(fila: FilaTrimestre): Trimestre {
  return {
    id: fila.id,
    cursoAcademicoId: fila.curso_academico_id,
    numero: fila.numero,
    fechaInicio: fila.fecha_inicio,
    fechaFin: fila.fecha_fin,
    estado: fila.estado
  }
}

export function cursosDeAlumno(db: BaseDatos, alumnoId: number): CursoAcademico[] {
  const filas = db
    .prepare('SELECT * FROM curso_academico WHERE alumno_id = ? ORDER BY curso DESC')
    .all(alumnoId) as FilaCurso[]
  return filas.map(aCurso)
}

/** El curso activo de cada alumno que lo tiene, en una sola consulta. */
export function cursosActivos(db: BaseDatos): Map<number, CursoAcademico> {
  const filas = db.prepare("SELECT * FROM curso_academico WHERE estado = 'activo'").all() as FilaCurso[]
  return new Map(filas.map((f) => [f.alumno_id, aCurso(f)]))
}

export function obtenerCurso(db: BaseDatos, id: number): CursoAcademico | null {
  const fila = db.prepare('SELECT * FROM curso_academico WHERE id = ?').get(id) as FilaCurso | undefined
  return fila ? aCurso(fila) : null
}

export function trimestresDeCurso(db: BaseDatos, cursoId: number): Trimestre[] {
  const filas = db
    .prepare('SELECT * FROM trimestre WHERE curso_academico_id = ? ORDER BY numero')
    .all(cursoId) as FilaTrimestre[]
  return filas.map(aTrimestre)
}

export function insertarCurso(
  db: BaseDatos,
  datos: { alumnoId: number; curso: string; nivelEducativo: string | null; cursoAnteriorId: number | null }
): number {
  const resultado = db
    .prepare(
      `INSERT INTO curso_academico (alumno_id, curso, nivel_educativo, curso_anterior_id)
       VALUES (@alumnoId, @curso, @nivelEducativo, @cursoAnteriorId)`
    )
    .run(datos)
  return Number(resultado.lastInsertRowid)
}

export function insertarTrimestre(db: BaseDatos, cursoId: number, periodo: PeriodoTrimestre): void {
  db.prepare(
    `INSERT INTO trimestre (curso_academico_id, numero, fecha_inicio, fecha_fin)
     VALUES (?, ?, ?, ?)`
  ).run(cursoId, periodo.numero, periodo.fechaInicio, periodo.fechaFin)
}

export function actualizarNivelEducativo(db: BaseDatos, cursoId: number, nivelEducativo: string | null): void {
  db.prepare('UPDATE curso_academico SET nivel_educativo = ? WHERE id = ?').run(nivelEducativo, cursoId)
}

export function actualizarFechasTrimestre(db: BaseDatos, trimestreId: number, periodo: PeriodoTrimestre): void {
  db.prepare('UPDATE trimestre SET fecha_inicio = ?, fecha_fin = ? WHERE id = ?').run(
    periodo.fechaInicio,
    periodo.fechaFin,
    trimestreId
  )
}
