import { problemaDeFechaPasada } from './curso'
import type { Fecha } from './entidades'

export type CampoActa = 'fecha' | 'asistentes' | 'contenido' | 'acuerdos'

export interface DatosActa {
  fecha: Fecha
  asistentes: string | null
  contenido: string | null
  acuerdos: string | null
}

export interface ProblemaActa {
  campo: CampoActa
  mensaje: string
}

export function normalizarActa(entrada: Partial<Record<CampoActa, unknown>>): DatosActa {
  const texto = (valor: unknown) => (typeof valor === 'string' ? valor.trim() : '')
  const opcional = (valor: unknown) => texto(valor) || null
  return {
    fecha: texto(entrada.fecha),
    asistentes: opcional(entrada.asistentes),
    contenido: opcional(entrada.contenido),
    acuerdos: opcional(entrada.acuerdos)
  }
}

/**
 * Un acta recoge una reunión que ya ha pasado. Basta con el contenido o con los acuerdos: a veces
 * lo único que hay que dejar escrito es lo que se acordó.
 */
export function validarActa(datos: DatosActa, curso: string, hoy: Fecha): ProblemaActa[] {
  const problemas: ProblemaActa[] = []

  const problemaFecha = problemaDeFechaPasada(datos.fecha, curso, hoy, 'de la reunión')
  if (problemaFecha) problemas.push({ campo: 'fecha', mensaje: problemaFecha })

  if (datos.contenido === null && datos.acuerdos === null) {
    problemas.push({ campo: 'contenido', mensaje: 'Escribe el contenido de la reunión, los acuerdos, o ambos.' })
  }

  return problemas
}
