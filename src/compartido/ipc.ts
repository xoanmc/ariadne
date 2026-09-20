export const CANALES = {
  estado: 'datos:estado',
  reintentar: 'datos:reintentar',
  cambiarUbicacion: 'datos:cambiarUbicacion',
  abrirExistente: 'datos:abrirExistente',
  buscarBase: 'datos:buscarBase',
  mostrarEnCarpeta: 'datos:mostrarEnCarpeta',
  listarCopias: 'copias:listar',
  guardarCopia: 'copias:guardar',
  restaurarCopia: 'copias:restaurar',
  restaurarDesdeFichero: 'copias:restaurarDesdeFichero'
} as const

export type EstadoDatos =
  | { tipo: 'lista'; ruta: string; avisoCopia?: string }
  | { tipo: 'ausente'; ruta: string }
  | { tipo: 'error'; ruta: string; mensaje: string }

export interface Copia {
  ruta: string
  nombre: string
  fecha: string
  tamano: number
}

export type ResultadoCopia =
  | { tipo: 'cancelado' }
  | { tipo: 'guardada'; ruta: string }
  | { tipo: 'error'; mensaje: string }

export type ResultadoRestauracion =
  | { tipo: 'cancelado' }
  | { tipo: 'restaurada'; ruta: string; copiaPrevia: string }
  | { tipo: 'error'; mensaje: string }

export type ResultadoCambio =
  | { tipo: 'cancelado' }
  | { tipo: 'movida'; ruta: string }
  | { tipo: 'abierta'; ruta: string }
  | { tipo: 'existe'; ruta: string }
  | { tipo: 'error'; mensaje: string }

export interface AriadneApi {
  datos: {
    estado(): Promise<EstadoDatos>
    reintentar(): Promise<EstadoDatos>
    cambiarUbicacion(): Promise<ResultadoCambio>
    abrirExistente(): Promise<ResultadoCambio>
    buscarBase(): Promise<ResultadoCambio>
    mostrarEnCarpeta(): Promise<void>
  }
  copias: {
    listar(): Promise<Copia[]>
    guardar(): Promise<ResultadoCopia>
    restaurar(ruta: string): Promise<ResultadoRestauracion>
    restaurarDesdeFichero(): Promise<ResultadoRestauracion>
  }
}
