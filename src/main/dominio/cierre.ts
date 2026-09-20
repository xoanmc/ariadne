import type { NumeroTrimestre } from './entidades'
import { esArrastrable, estaValorado, type Valoracion } from './vocabulario'

export interface ObjetivoValorado {
  asignacionId: number
  objetivoId: number
  valoracion: Valoracion
}

export function sinValorar<T extends ObjetivoValorado>(objetivos: readonly T[]): T[] {
  return objetivos.filter((o) => !estaValorado(o.valoracion))
}

/** RF-18: un trimestre no se cierra mientras quede algo sin valorar. Es la regla que da valor al cierre. */
export function puedeCerrarseTrimestre(objetivos: readonly ObjetivoValorado[]): boolean {
  return sinValorar(objetivos).length === 0
}

/** Lo que puede pasar al trimestre siguiente: lo no conseguido y lo que no llegó a abordarse. */
export function arrastrables<T extends ObjetivoValorado>(objetivos: readonly T[]): T[] {
  return objetivos.filter((o) => esArrastrable(o.valoracion))
}

/** RF-07: el curso no se cierra a mano, se cierra como efecto de cerrar su tercer trimestre. */
export function elCierreCierraElCurso(numero: NumeroTrimestre): boolean {
  return numero === 3
}
