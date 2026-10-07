import type { ListaDeOpciones, ResultadoCatalogo } from '../../compartido/ipc'
import { CATEGORIAS, claveDeOpcion, esCategoria, NOMBRES_CATEGORIA, normalizarOpcion, problemaDeOpcion } from '../dominio/catalogo'
import type { CategoriaCatalogo } from '../dominio/entidades'
import type { BaseDatos } from '../persistencia/baseDatos'
import * as repositorio from '../persistencia/repositorioCatalogo'
import { esId } from './entrada'

export function listarCatalogo(db: BaseDatos): ListaDeOpciones[] {
  return CATEGORIAS.map((categoria) => ({
    categoria,
    nombre: NOMBRES_CATEGORIA[categoria],
    opciones: repositorio.opcionesDe(db, categoria).map(({ id, texto, activa }) => ({ id, texto, activa }))
  }))
}

const guardado = (db: BaseDatos): ResultadoCatalogo => ({ tipo: 'guardado', listas: listarCatalogo(db) })

/** Texto válido y que no repita otra opción de la misma lista, salvo la que se está corrigiendo. */
function problemaDeTexto(db: BaseDatos, categoria: CategoriaCatalogo, texto: string, excepto?: number): string | null {
  const problema = problemaDeOpcion(texto)
  if (problema) return problema
  const clave = claveDeOpcion(texto)
  const repetida = repositorio.opcionesDe(db, categoria).find((o) => o.id !== excepto && claveDeOpcion(o.texto) === clave)
  if (!repetida) return null
  return repetida.activa ? `Ya existe la opción «${repetida.texto}».` : `Ya existe la opción «${repetida.texto}», desactivada: puedes reactivarla.`
}

export function anadirOpcion(db: BaseDatos, categoria: unknown, texto: unknown): ResultadoCatalogo {
  if (!esCategoria(categoria)) return { tipo: 'invalido', mensaje: 'Esa lista no existe.' }
  const limpio = normalizarOpcion(texto)
  const problema = problemaDeTexto(db, categoria, limpio)
  if (problema) return { tipo: 'invalido', mensaje: problema }

  repositorio.insertarOpcion(db, categoria, limpio)
  return guardado(db)
}

/** Corregir una opción solo cambia lo que se registre después: las sesiones guardan sus propias palabras. */
export function renombrarOpcion(db: BaseDatos, opcionId: unknown, texto: unknown): ResultadoCatalogo {
  const opcion = esId(opcionId) ? repositorio.obtenerOpcion(db, opcionId) : null
  if (!opcion) return { tipo: 'invalido', mensaje: 'Esa opción no existe.' }
  const limpio = normalizarOpcion(texto)
  const problema = problemaDeTexto(db, opcion.categoria, limpio, opcion.id)
  if (problema) return { tipo: 'invalido', mensaje: problema }

  repositorio.actualizarTexto(db, opcion.id, limpio)
  return guardado(db)
}

/** Desactivar en lugar de borrar: deja de ofrecerse, pero se puede recuperar. */
export function activarOpcion(db: BaseDatos, opcionId: unknown, activa: unknown): ResultadoCatalogo {
  const opcion = esId(opcionId) ? repositorio.obtenerOpcion(db, opcionId) : null
  if (!opcion) return { tipo: 'invalido', mensaje: 'Esa opción no existe.' }
  repositorio.cambiarActiva(db, opcion.id, activa === true)
  return guardado(db)
}

export function moverOpcion(db: BaseDatos, opcionId: unknown, hacia: unknown): ResultadoCatalogo {
  const opcion = esId(opcionId) ? repositorio.obtenerOpcion(db, opcionId) : null
  if (!opcion || (hacia !== 'arriba' && hacia !== 'abajo')) return { tipo: 'invalido', mensaje: 'Esa opción no existe.' }

  const ids = repositorio.opcionesDe(db, opcion.categoria).map((o) => o.id)
  const desde = ids.indexOf(opcion.id)
  const hasta = hacia === 'arriba' ? desde - 1 : desde + 1
  if (hasta < 0 || hasta >= ids.length) return guardado(db)

  ;[ids[desde], ids[hasta]] = [ids[hasta], ids[desde]]
  db.transaction(() => repositorio.reordenar(db, ids))()
  return guardado(db)
}
