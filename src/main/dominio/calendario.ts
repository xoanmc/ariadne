import type { Fecha, NumeroTrimestre } from './entidades'

export interface PeriodoTrimestre {
  numero: NumeroTrimestre
  fechaInicio: Fecha
  fechaFin: Fecha
}

export type ProblemaCalendario =
  | { tipo: 'faltan_trimestres'; numeros: NumeroTrimestre[] }
  | { tipo: 'trimestre_repetido'; numero: NumeroTrimestre }
  | { tipo: 'fecha_no_valida'; numero: NumeroTrimestre }
  | { tipo: 'acaba_antes_de_empezar'; numero: NumeroTrimestre }
  | { tipo: 'solapan'; numero: NumeroTrimestre; conNumero: NumeroTrimestre }

/**
 * Dónde cae una fecha dentro del curso. `vacaciones` es el hueco legítimo entre dos trimestres
 * (Navidad, Semana Santa): las fechas propuestas por el centro lo tienen por definición.
 */
export type UbicacionFecha =
  | { tipo: 'dentro'; numero: NumeroTrimestre }
  | { tipo: 'vacaciones'; trasNumero: NumeroTrimestre; antesDeNumero: NumeroTrimestre }
  | { tipo: 'antes_del_curso' }
  | { tipo: 'despues_del_curso' }

const FORMATO = /^\d{4}-\d{2}-\d{2}$/

export function esFecha(valor: string): valor is Fecha {
  if (!FORMATO.test(valor)) return false
  const fecha = new Date(`${valor}T00:00:00Z`)
  return !Number.isNaN(fecha.getTime()) && fecha.toISOString().startsWith(valor)
}

function ordenados(periodos: readonly PeriodoTrimestre[]): PeriodoTrimestre[] {
  return [...periodos].sort((a, b) => a.numero - b.numero)
}

/**
 * Los tres trimestres no pueden solaparse ni acabar antes de empezar. Los huecos entre ellos sí se
 * admiten: son las vacaciones.
 */
export function validarCalendario(periodos: readonly PeriodoTrimestre[]): ProblemaCalendario[] {
  const problemas: ProblemaCalendario[] = []
  const numeros = periodos.map((p) => p.numero)

  const faltan = ([1, 2, 3] as NumeroTrimestre[]).filter((n) => !numeros.includes(n))
  if (faltan.length > 0) problemas.push({ tipo: 'faltan_trimestres', numeros: faltan })

  new Set(numeros.filter((n, i) => numeros.indexOf(n) !== i)).forEach((numero) =>
    problemas.push({ tipo: 'trimestre_repetido', numero })
  )

  for (const periodo of ordenados(periodos)) {
    if (!esFecha(periodo.fechaInicio) || !esFecha(periodo.fechaFin)) {
      problemas.push({ tipo: 'fecha_no_valida', numero: periodo.numero })
    } else if (periodo.fechaFin < periodo.fechaInicio) {
      problemas.push({ tipo: 'acaba_antes_de_empezar', numero: periodo.numero })
    }
  }

  const validos = ordenados(periodos).filter(
    (p) => esFecha(p.fechaInicio) && esFecha(p.fechaFin) && p.fechaFin >= p.fechaInicio
  )
  for (let i = 0; i < validos.length - 1; i++) {
    const actual = validos[i]
    const siguiente = validos[i + 1]
    if (siguiente.fechaInicio <= actual.fechaFin) {
      problemas.push({ tipo: 'solapan', numero: actual.numero, conNumero: siguiente.numero })
    }
  }

  return problemas
}

export function situarFecha(periodos: readonly PeriodoTrimestre[], fecha: Fecha): UbicacionFecha {
  const curso = ordenados(periodos)
  if (curso.length === 0) return { tipo: 'antes_del_curso' }

  const dentro = curso.find((p) => fecha >= p.fechaInicio && fecha <= p.fechaFin)
  if (dentro) return { tipo: 'dentro', numero: dentro.numero }

  if (fecha < curso[0].fechaInicio) return { tipo: 'antes_del_curso' }
  if (fecha > curso[curso.length - 1].fechaFin) return { tipo: 'despues_del_curso' }

  const anterior = [...curso].reverse().find((p) => p.fechaFin < fecha)!
  const siguiente = curso.find((p) => p.fechaInicio > fecha)!
  return { tipo: 'vacaciones', trasNumero: anterior.numero, antesDeNumero: siguiente.numero }
}
