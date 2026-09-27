import type { DatosActa } from '../dominio/acta'
import type { ActaReunion } from '../dominio/entidades'
import type { BaseDatos } from './baseDatos'

interface FilaActa {
  id: number
  curso_academico_id: number
  fecha: string
  asistentes: string | null
  contenido: string | null
  acuerdos: string | null
}

function aActa(fila: FilaActa): ActaReunion {
  return {
    id: fila.id,
    cursoAcademicoId: fila.curso_academico_id,
    fecha: fila.fecha,
    asistentes: fila.asistentes,
    contenido: fila.contenido,
    acuerdos: fila.acuerdos
  }
}

/** De la más reciente a la más antigua. */
export function actasDeCurso(db: BaseDatos, cursoId: number): ActaReunion[] {
  const filas = db
    .prepare('SELECT * FROM acta_reunion WHERE curso_academico_id = ? ORDER BY fecha DESC, id DESC')
    .all(cursoId) as FilaActa[]
  return filas.map(aActa)
}

export function obtenerActa(db: BaseDatos, id: number): ActaReunion | null {
  const fila = db.prepare('SELECT * FROM acta_reunion WHERE id = ?').get(id) as FilaActa | undefined
  return fila ? aActa(fila) : null
}

export function insertarActa(db: BaseDatos, cursoId: number, datos: DatosActa): number {
  const resultado = db
    .prepare(
      `INSERT INTO acta_reunion (curso_academico_id, fecha, asistentes, contenido, acuerdos)
       VALUES (@cursoId, @fecha, @asistentes, @contenido, @acuerdos)`
    )
    .run({ cursoId, ...datos })
  return Number(resultado.lastInsertRowid)
}

export function actualizarActa(db: BaseDatos, id: number, datos: DatosActa): void {
  db.prepare(
    `UPDATE acta_reunion SET fecha = @fecha, asistentes = @asistentes, contenido = @contenido, acuerdos = @acuerdos
     WHERE id = @id`
  ).run({ id, ...datos })
}
