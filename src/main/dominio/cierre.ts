import type { NumeroTrimestre } from './entidades'
import { esArrastrable, estaValorado, seTrabajo, type Valoracion } from './vocabulario'

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

/**
 * Adónde pasa lo arrastrado al cerrar un trimestre. Del tercero no pasa a ninguno: lo pendiente al
 * acabar el curso se ofrece al abrir el curso siguiente (T3.2).
 */
export function trimestreSiguiente(numero: NumeroTrimestre): NumeroTrimestre | null {
  return numero === 3 ? null : ((numero + 1) as NumeroTrimestre)
}

/** RF-07: el curso no se cierra a mano, se cierra como efecto de cerrar su tercer trimestre. */
export function elCierreCierraElCurso(numero: NumeroTrimestre): boolean {
  return numero === 3
}

export interface ObjetivoEnVerificacion extends ObjetivoValorado {
  /** En cuántas sesiones del trimestre se marcó como trabajado. Las faltas no cuentan. */
  sesiones: number
}

/**
 * Su valoración y sus sesiones no cuadran. Se avisa, nunca se bloquea: marcar los objetivos en la
 * sesión es opcional, así que un objetivo puede haberse trabajado sin quedar anotado.
 */
export type Incoherencia =
  | 'no_trabajado_con_sesiones' // pendiente de desarrollar, pero aparece en sesiones
  | 'trabajado_sin_sesiones' // conseguido o no conseguido, pero no aparece en ninguna

export interface Verificacion {
  sinValorar: number[]
  noTrabajados: number[]
  sinSesiones: number[]
  incoherencias: { asignacionId: number; tipo: Incoherencia }[]
  sesiones: number
  faltas: number
  /** RF-18: lo único que bloquea el cierre es que quede algo sin valorar. */
  puedeCerrarse: boolean
}

export function incoherenciaDe(objetivo: ObjetivoEnVerificacion): Incoherencia | null {
  if (objetivo.valoracion === 'pendiente_desarrollar' && objetivo.sesiones > 0) return 'no_trabajado_con_sesiones'
  if (seTrabajo(objetivo.valoracion) && objetivo.sesiones === 0) return 'trabajado_sin_sesiones'
  return null
}

/**
 * RF-17: las cuatro preguntas del cierre, respondidas consultando los datos. Las listas son de
 * asignaciones, en el orden en que llegan los objetivos.
 */
export function verificarTrimestre(
  objetivos: readonly ObjetivoEnVerificacion[],
  recuento: { sesiones: number; faltas: number }
): Verificacion {
  const ids = (lista: readonly ObjetivoEnVerificacion[]) => lista.map((o) => o.asignacionId)
  return {
    sinValorar: ids(sinValorar(objetivos)),
    noTrabajados: ids(objetivos.filter((o) => estaValorado(o.valoracion) && !seTrabajo(o.valoracion))),
    sinSesiones: ids(objetivos.filter((o) => o.sesiones === 0)),
    incoherencias: objetivos.flatMap((o) => {
      const tipo = incoherenciaDe(o)
      return tipo ? [{ asignacionId: o.asignacionId, tipo }] : []
    }),
    sesiones: recuento.sesiones,
    faltas: recuento.faltas,
    puedeCerrarse: puedeCerrarseTrimestre(objetivos)
  }
}
