import type { CategoriaCatalogo } from './entidades'

export const CATEGORIAS: readonly CategoriaCatalogo[] = ['estado_alumno', 'respuesta_actividades']

/** Los nombres que da la especificación a los dos campos centrales del registro de sesión. */
export const NOMBRES_CATEGORIA: Record<CategoriaCatalogo, string> = {
  estado_alumno: 'Estado del alumno en la sesión',
  respuesta_actividades: 'Respuesta a las actividades'
}

/** Una opción es una o pocas palabras que se pulsan al registrar: si se alarga, deja de ser rápida. */
export const LONGITUD_MAXIMA = 60

export function esCategoria(valor: unknown): valor is CategoriaCatalogo {
  return (CATEGORIAS as readonly unknown[]).includes(valor)
}

export function normalizarOpcion(valor: unknown): string {
  return typeof valor === 'string' ? valor.trim().replace(/\s+/g, ' ') : ''
}

export function problemaDeOpcion(texto: string): string | null {
  if (texto === '') return 'Escribe la opción.'
  // Las opciones marcadas se guardan separadas por comas: una coma dentro de una opción la partiría en dos
  if (texto.includes(',')) return 'Una opción no puede llevar comas.'
  if (texto.length > LONGITUD_MAXIMA) return `Una opción tiene que ser corta: como mucho ${LONGITUD_MAXIMA} caracteres.`
  return null
}

/** Dos opciones son la misma aunque cambien mayúsculas o acentos: "Tranquilo" y "tranquilo". */
export function claveDeOpcion(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}
