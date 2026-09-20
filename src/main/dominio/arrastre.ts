import type { Valoracion } from './vocabulario'

/**
 * El recorrido histórico de un objetivo se obtiene siempre recorriendo asignaciones, nunca la tabla
 * de objetivos: un objetivo no cruza de curso, la cadena sí.
 */
export interface Eslabon {
  id: number
  trimestreId: number
  valoracion: Valoracion
  asignacionAnteriorId: number | null
}

export class ErrorCadena extends Error {}

/** Devuelve la cadena que termina en `id`, de la asignación más antigua a la más reciente. */
export function recorrerCadena<T extends Eslabon>(asignaciones: readonly T[], id: number): T[] {
  const porId = new Map(asignaciones.map((a) => [a.id, a]))
  const inicial = porId.get(id)
  if (!inicial) throw new ErrorCadena(`No se encontró la asignación ${id}`)

  const cadena: T[] = []
  const vistos = new Set<number>()
  let actual: T | undefined = inicial

  while (actual) {
    if (vistos.has(actual.id)) {
      throw new ErrorCadena(`La cadena de arrastre se muerde la cola en la asignación ${actual.id}`)
    }
    vistos.add(actual.id)
    cadena.push(actual)
    actual = actual.asignacionAnteriorId === null ? undefined : porId.get(actual.asignacionAnteriorId)
  }

  return cadena.reverse()
}

/**
 * Una cadena está completa si llega hasta el origen del objetivo. Si el primer eslabón todavía
 * apunta a una asignación anterior, es que el llamante no cargó todo el historial.
 */
export function estaCompleta(cadena: readonly Eslabon[]): boolean {
  return cadena.length > 0 && cadena[0].asignacionAnteriorId === null
}

/** Trimestres consecutivos, contando hacia atrás desde el último, en los que el objetivo no llegó a trabajarse. */
export function rachaPendienteDesarrollar(cadena: readonly Eslabon[]): number {
  let racha = 0
  for (let i = cadena.length - 1; i >= 0; i--) {
    if (cadena[i].valoracion !== 'pendiente_desarrollar') break
    racha++
  }
  return racha
}

/** RF-20: el aviso salta al segundo trimestre consecutivo sin abordar, y sigue saltando si la racha continúa. */
export function estaEstancado(cadena: readonly Eslabon[]): boolean {
  return rachaPendienteDesarrollar(cadena) >= 2
}
