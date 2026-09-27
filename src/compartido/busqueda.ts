export interface Buscable {
  nombre: string
  apellidos: string
  codigoInterno: string
}

/** Minúsculas y sin acentos: "Lucía" y "lucia" tienen que encontrarse igual. */
export function normalizarBusqueda(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Cada palabra de la búsqueda tiene que aparecer en el nombre, los apellidos o el código, en
 * cualquier orden: "garcia luc" encuentra a Lucía García. El código vale con o sin guion.
 */
export function coincideBusqueda(alumno: Buscable, consulta: string): boolean {
  const palabras = normalizarBusqueda(consulta).split(' ').filter(Boolean)
  if (palabras.length === 0) return true

  const codigo = normalizarBusqueda(alumno.codigoInterno)
  const donde = normalizarBusqueda(`${alumno.nombre} ${alumno.apellidos} ${codigo} ${codigo.replace('-', '')}`)
  return palabras.every((palabra) => donde.includes(palabra))
}
