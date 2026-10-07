import type { NumeroTrimestre, ProgramaIntervencion } from '../dominio/entidades'
import type { Valoracion } from '../dominio/vocabulario'
import type { BaseDatos } from './baseDatos'

interface FilaPrograma {
  id: number
  curso_academico_id: number
  fecha_creacion: string
  fecha_revision: string | null
  contenido: string | null
}

export interface FilaAsignacionDePrograma {
  asignacionId: number
  objetivoId: number
  enunciado: string
  trimestreId: number
  numeroTrimestre: NumeroTrimestre
  valoracion: Valoracion
  comentario: string | null
  asignacionAnteriorId: number | null
}

function aPrograma(fila: FilaPrograma): ProgramaIntervencion {
  return {
    id: fila.id,
    cursoAcademicoId: fila.curso_academico_id,
    fechaCreacion: fila.fecha_creacion,
    fechaRevision: fila.fecha_revision,
    contenido: fila.contenido
  }
}

export function programaDeCurso(db: BaseDatos, cursoId: number): ProgramaIntervencion | null {
  const fila = db.prepare('SELECT * FROM programa_intervencion WHERE curso_academico_id = ?').get(cursoId) as
    | FilaPrograma
    | undefined
  return fila ? aPrograma(fila) : null
}

export function obtenerPrograma(db: BaseDatos, id: number): ProgramaIntervencion | null {
  const fila = db.prepare('SELECT * FROM programa_intervencion WHERE id = ?').get(id) as FilaPrograma | undefined
  return fila ? aPrograma(fila) : null
}

export function insertarPrograma(db: BaseDatos, cursoId: number, contenido: string | null, fecha: string): number {
  const resultado = db
    .prepare('INSERT INTO programa_intervencion (curso_academico_id, fecha_creacion, contenido) VALUES (?, ?, ?)')
    .run(cursoId, fecha, contenido)
  return Number(resultado.lastInsertRowid)
}

export function actualizarContenido(db: BaseDatos, programaId: number, contenido: string | null, fecha: string): void {
  db.prepare('UPDATE programa_intervencion SET contenido = ?, fecha_revision = ? WHERE id = ?').run(contenido, fecha, programaId)
}

export function marcarRevision(db: BaseDatos, programaId: number, fecha: string): void {
  db.prepare('UPDATE programa_intervencion SET fecha_revision = ? WHERE id = ?').run(fecha, programaId)
}

/** Devuelve el id de la asignación: un objetivo nace puesto en un trimestre, sin valorar. */
export function insertarObjetivoConAsignacion(
  db: BaseDatos,
  programaId: number,
  enunciado: string,
  trimestreId: number,
  fecha: string,
  asignacionAnteriorId: number | null = null
): number {
  const objetivo = db
    .prepare('INSERT INTO objetivo (programa_id, enunciado, fecha_creacion) VALUES (?, ?, ?)')
    .run(programaId, enunciado, fecha)
  const asignacion = db
    .prepare('INSERT INTO asignacion_trimestral (objetivo_id, trimestre_id, asignacion_anterior_id) VALUES (?, ?, ?)')
    .run(objetivo.lastInsertRowid, trimestreId, asignacionAnteriorId)
  return Number(asignacion.lastInsertRowid)
}

/** Una fila por asignación: un mismo objetivo arrastrado aparece en cada trimestre en el que estuvo. */
export function asignacionesDePrograma(db: BaseDatos, programaId: number): FilaAsignacionDePrograma[] {
  return db
    .prepare(
      `SELECT a.id AS asignacionId, o.id AS objetivoId, o.enunciado, t.id AS trimestreId,
              t.numero AS numeroTrimestre, a.valoracion, a.comentario, a.asignacion_anterior_id AS asignacionAnteriorId
       FROM asignacion_trimestral a
       JOIN objetivo o ON o.id = a.objetivo_id
       JOIN trimestre t ON t.id = a.trimestre_id
       WHERE o.programa_id = ?
       ORDER BY t.numero, o.id`
    )
    .all(programaId) as FilaAsignacionDePrograma[]
}
