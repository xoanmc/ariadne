/** Hoy en el calendario del equipo, como AAAA-MM-DD: lo que esperan los campos de fecha. */
export function hoy(): string {
  const ahora = new Date()
  const dos = (n: number) => String(n).padStart(2, '0')
  return `${ahora.getFullYear()}-${dos(ahora.getMonth() + 1)}-${dos(ahora.getDate())}`
}

/** "10 sept 2026" */
export function fechaCorta(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })
}
