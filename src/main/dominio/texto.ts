export function normalizarEspacios(texto: string): string {
  return texto.trim().replace(/\s+/g, ' ')
}
