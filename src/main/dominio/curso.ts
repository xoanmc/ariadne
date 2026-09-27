import { esFecha, validarCalendario, type PeriodoTrimestre, type ProblemaCalendario } from './calendario'
import type { Fecha, NumeroTrimestre } from './entidades'

export type CampoCurso = 'curso' | 'nivelEducativo' | 'trimestre1' | 'trimestre2' | 'trimestre3'

export interface ProblemaCurso {
  campo: CampoCurso
  mensaje: string
}

const FORMATO_CURSO = /^(\d{4})\/(\d{4})$/

/** Años de un curso `2026/2027`, o null si no tiene ese formato o los años no son consecutivos. */
export function extremosDeCurso(curso: string): [number, number] | null {
  const coincidencia = FORMATO_CURSO.exec(curso)
  if (!coincidencia) return null
  const inicio = Number(coincidencia[1])
  const fin = Number(coincidencia[2])
  return fin === inicio + 1 ? [inicio, fin] : null
}

/** El curso que toca por la fecha: a partir de agosto ya se prepara el que empieza en septiembre. */
export function cursoDeFecha(fecha: Fecha): string {
  const inicio = Number(fecha.slice(0, 4))
  const mes = Number(fecha.slice(5, 7))
  return mes >= 8 ? `${inicio}/${inicio + 1}` : `${inicio - 1}/${inicio}`
}

/** Punto de partida neutro, en meses completos: ella lo corrige con el calendario real de su centro. */
export function fechasPropuestas(curso: string): PeriodoTrimestre[] {
  const extremos = extremosDeCurso(curso)
  if (!extremos) throw new RangeError(`Curso no válido: ${curso}`)
  const [inicio, fin] = extremos
  return [
    { numero: 1, fechaInicio: `${inicio}-09-01`, fechaFin: `${inicio}-12-31` },
    { numero: 2, fechaInicio: `${fin}-01-01`, fechaFin: `${fin}-03-31` },
    { numero: 3, fechaInicio: `${fin}-04-01`, fechaFin: `${fin}-06-30` }
  ]
}

function campoDe(numero: NumeroTrimestre): CampoCurso {
  return `trimestre${numero}`
}

function mensajeDe(problema: ProblemaCalendario): ProblemaCurso[] {
  switch (problema.tipo) {
    case 'faltan_trimestres':
      return problema.numeros.map((n) => ({ campo: campoDe(n), mensaje: `Faltan las fechas del trimestre ${n}.` }))
    case 'trimestre_repetido':
      return [{ campo: campoDe(problema.numero), mensaje: `El trimestre ${problema.numero} está repetido.` }]
    case 'fecha_no_valida':
      return [{ campo: campoDe(problema.numero), mensaje: 'Alguna de las dos fechas no es una fecha válida.' }]
    case 'acaba_antes_de_empezar':
      return [{ campo: campoDe(problema.numero), mensaje: 'La fecha de fin es anterior a la de inicio.' }]
    case 'solapan':
      return [
        {
          campo: campoDe(problema.conNumero),
          mensaje: `Empieza antes de que acabe el trimestre ${problema.numero}. Los trimestres no pueden solaparse.`
        }
      ]
  }
}

/**
 * Los trimestres no pueden solaparse ni acabar antes de empezar, y todas sus fechas tienen que caer
 * en los dos años del curso: así se cazan erratas como 2062 por 2026. Los huecos entre trimestres
 * se admiten, porque son las vacaciones.
 */
export function validarCurso(curso: string, periodos: readonly PeriodoTrimestre[]): ProblemaCurso[] {
  const extremos = extremosDeCurso(curso)
  if (!extremos) {
    return [{ campo: 'curso', mensaje: 'Escribe el curso con sus dos años seguidos, por ejemplo 2026/2027.' }]
  }

  const problemas = validarCalendario(periodos).flatMap(mensajeDe)

  for (const periodo of periodos) {
    const campo = campoDe(periodo.numero)
    if (problemas.some((p) => p.campo === campo)) continue
    const fuera = [periodo.fechaInicio, periodo.fechaFin].some(
      (f) => esFecha(f) && !extremos.includes(Number(f.slice(0, 4)))
    )
    if (fuera) {
      problemas.push({ campo, mensaje: `Las fechas tienen que ser de ${extremos[0]} o de ${extremos[1]}, los años del curso.` })
    }
  }

  return problemas
}

/**
 * Solo se abre un curso posterior a los que ya tiene: el enlace al anterior forma una cadena que no
 * se puede bifurcar, y meter un curso en medio la rompería.
 */
export function esPosteriorATodos(curso: string, existentes: readonly string[]): boolean {
  return existentes.every((existente) => curso > existente)
}
