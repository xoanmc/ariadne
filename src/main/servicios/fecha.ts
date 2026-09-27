import type { Fecha } from '../dominio/entidades'

/** La fecha de hoy en el calendario del equipo, no en UTC: a las once de la noche sigue siendo hoy. */
export function hoyLocal(ahora = new Date()): Fecha {
  const dos = (n: number) => String(n).padStart(2, '0')
  return `${ahora.getFullYear()}-${dos(ahora.getMonth() + 1)}-${dos(ahora.getDate())}`
}
