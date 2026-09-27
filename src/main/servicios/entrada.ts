// Lo que llega de la interfaz se trata como no confiable: es la frontera del proceso principal.

export function esId(valor: unknown): valor is number {
  return Number.isInteger(valor) && (valor as number) > 0
}

export function textoOpcional(valor: unknown): string | null {
  if (typeof valor !== 'string') return null
  const limpio = valor.trim()
  return limpio === '' ? null : limpio
}
