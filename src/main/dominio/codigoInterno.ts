// El código sustituye al nombre en todo lo que sale del equipo (P6). Por eso no lleva nada que
// identifique: ni iniciales, ni año de nacimiento, ni curso. Solo el orden de alta.

const PREFIJO = 'A-'

export function formatearCodigo(numero: number): string {
  if (!Number.isInteger(numero) || numero < 1) {
    throw new RangeError(`Número de código no válido: ${numero}`)
  }
  return `${PREFIJO}${String(numero).padStart(2, '0')}`
}

/** Siguiente código a partir del último número entregado, nunca a partir de los alumnos que quedan. */
export function siguienteCodigo(ultimoEntregado: number): string {
  return formatearCodigo(ultimoEntregado + 1)
}
