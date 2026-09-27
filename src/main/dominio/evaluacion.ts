import { problemaDeFechaPasada } from './curso'
import type { Fecha } from './entidades'

export type CampoEvaluacion = 'fecha' | 'instrumento' | 'contenido'

export interface DatosEvaluacion {
  fecha: Fecha
  instrumento: string | null
  contenido: string
}

export interface ProblemaEvaluacion {
  campo: CampoEvaluacion
  mensaje: string
}

/** Los que nombra la especificación; se ofrecen como sugerencia, nunca como lista cerrada. */
export const INSTRUMENTOS_HABITUALES = ['Diverlexia', 'Prolexia'] as const

export function normalizarEvaluacion(entrada: Partial<Record<CampoEvaluacion, unknown>>): DatosEvaluacion {
  const texto = (valor: unknown) => (typeof valor === 'string' ? valor.trim() : '')
  const instrumento = texto(entrada.instrumento).replace(/\s+/g, ' ')
  return {
    fecha: texto(entrada.fecha),
    instrumento: instrumento === '' ? null : instrumento,
    contenido: texto(entrada.contenido)
  }
}

/** La evaluación ya se hizo: no puede ser futura, y tiene que caer en los años del curso. */
export function validarEvaluacion(datos: DatosEvaluacion, curso: string, hoy: Fecha): ProblemaEvaluacion[] {
  const problemas: ProblemaEvaluacion[] = []

  const problemaFecha = problemaDeFechaPasada(datos.fecha, curso, hoy, 'de la evaluación')
  if (problemaFecha) problemas.push({ campo: 'fecha', mensaje: problemaFecha })

  if (datos.contenido === '') {
    problemas.push({ campo: 'contenido', mensaje: 'Escribe el contenido de la evaluación.' })
  }

  return problemas
}

/**
 * Sugerencias para el campo de instrumento: los habituales y los que ella ya ha usado, sin
 * repetir aunque los haya escrito con distintas mayúsculas.
 */
export function sugerenciasDeInstrumento(usados: readonly string[]): string[] {
  const vistos = new Map<string, string>()
  for (const instrumento of [...INSTRUMENTOS_HABITUALES, ...usados]) {
    const clave = instrumento.trim().toLocaleLowerCase('es')
    if (clave !== '' && !vistos.has(clave)) vistos.set(clave, instrumento.trim())
  }
  return [...vistos.values()].sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' }))
}
