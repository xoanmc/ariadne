export interface ProblemaObjetivo {
  campo: 'enunciado' | 'trimestre'
  mensaje: string
}

export function normalizarEnunciado(valor: unknown): string {
  return typeof valor === 'string' ? valor.trim().replace(/[ \t]+/g, ' ') : ''
}

export function validarEnunciado(enunciado: string): ProblemaObjetivo[] {
  return enunciado === '' ? [{ campo: 'enunciado', mensaje: 'Escribe el enunciado del objetivo.' }] : []
}
