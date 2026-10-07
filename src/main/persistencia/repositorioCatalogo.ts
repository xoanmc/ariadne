import type { CategoriaCatalogo, OpcionCatalogo } from '../dominio/entidades'
import type { BaseDatos } from './baseDatos'

interface FilaOpcion {
  id: number
  categoria: CategoriaCatalogo
  texto: string
  orden: number
  activa: number
}

function aOpcion(fila: FilaOpcion): OpcionCatalogo {
  return { id: fila.id, categoria: fila.categoria, texto: fila.texto, orden: fila.orden, activa: fila.activa === 1 }
}

export function opcionesDe(db: BaseDatos, categoria: CategoriaCatalogo): OpcionCatalogo[] {
  const filas = db
    .prepare('SELECT * FROM opcion_catalogo WHERE categoria = ? ORDER BY orden, id')
    .all(categoria) as FilaOpcion[]
  return filas.map(aOpcion)
}

export function obtenerOpcion(db: BaseDatos, id: number): OpcionCatalogo | null {
  const fila = db.prepare('SELECT * FROM opcion_catalogo WHERE id = ?').get(id) as FilaOpcion | undefined
  return fila ? aOpcion(fila) : null
}

/** Las nuevas van al final de su lista. */
export function insertarOpcion(db: BaseDatos, categoria: CategoriaCatalogo, texto: string): number {
  const { siguiente } = db
    .prepare('SELECT COALESCE(MAX(orden), 0) + 1 AS siguiente FROM opcion_catalogo WHERE categoria = ?')
    .get(categoria) as { siguiente: number }
  return Number(
    db.prepare('INSERT INTO opcion_catalogo (categoria, texto, orden) VALUES (?, ?, ?)').run(categoria, texto, siguiente)
      .lastInsertRowid
  )
}

export function actualizarTexto(db: BaseDatos, id: number, texto: string): void {
  db.prepare('UPDATE opcion_catalogo SET texto = ? WHERE id = ?').run(texto, id)
}

export function cambiarActiva(db: BaseDatos, id: number, activa: boolean): void {
  db.prepare('UPDATE opcion_catalogo SET activa = ? WHERE id = ?').run(activa ? 1 : 0, id)
}

/** Deja la lista con el orden indicado, numerado de nuevo desde 1. */
export function reordenar(db: BaseDatos, idsEnOrden: readonly number[]): void {
  const actualizar = db.prepare('UPDATE opcion_catalogo SET orden = ? WHERE id = ?')
  idsEnOrden.forEach((id, i) => actualizar.run(i + 1, id))
}
