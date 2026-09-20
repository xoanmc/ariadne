// Las palabras son suyas y preexistentes (P10). Esta es la única fuente: nadie escribe estos literales a mano.

export const VALORACIONES = ['sin_valorar', 'conseguido', 'no_conseguido', 'pendiente_desarrollar'] as const
export type Valoracion = (typeof VALORACIONES)[number]

export const ESTADOS_CURSO = ['activo', 'cerrado'] as const
export type EstadoCurso = (typeof ESTADOS_CURSO)[number]

export const ESTADOS_TRIMESTRE = ['abierto', 'cerrado'] as const
export type EstadoTrimestre = (typeof ESTADOS_TRIMESTRE)[number]

export const ETIQUETAS_VALORACION: Record<Valoracion, string> = {
  sin_valorar: 'sin valorar',
  conseguido: 'conseguido',
  no_conseguido: 'no conseguido',
  pendiente_desarrollar: 'pendiente de desarrollar'
}

// La rúbrica distingue dos cosas a la vez: si el objetivo llegó a trabajarse y con qué resultado.
const SE_TRABAJO: Record<Valoracion, boolean> = {
  sin_valorar: false,
  conseguido: true,
  no_conseguido: true,
  pendiente_desarrollar: false
}

export function esValoracion(valor: string): valor is Valoracion {
  return (VALORACIONES as readonly string[]).includes(valor)
}

export function estaValorado(valoracion: Valoracion): boolean {
  return valoracion !== 'sin_valorar'
}

export function seTrabajo(valoracion: Valoracion): boolean {
  return SE_TRABAJO[valoracion]
}

// Solo se arrastra lo que sigue abierto: lo conseguido se cierra y lo no valorado impide cerrar el trimestre.
export function esArrastrable(valoracion: Valoracion): boolean {
  return valoracion === 'no_conseguido' || valoracion === 'pendiente_desarrollar'
}
