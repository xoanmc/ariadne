import { esFecha } from './calendario'
import { extremosDeCurso } from './curso'
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
  const extremos = extremosDeCurso(curso)

  if (!esFecha(datos.fecha)) {
    problemas.push({ campo: 'fecha', mensaje: 'Indica la fecha de la evaluación.' })
  } else if (datos.fecha > hoy) {
    problemas.push({ campo: 'fecha', mensaje: 'La fecha no puede ser posterior a hoy.' })
  } else if (extremos && !extremos.includes(Number(datos.fecha.slice(0, 4)))) {
    problemas.push({ campo: 'fecha', mensaje: `La fecha tiene que ser de ${extremos[0]} o de ${extremos[1]}, los años del curso.` })
  }

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
