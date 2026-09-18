export const CANALES = {
  estado: 'datos:estado',
  reintentar: 'datos:reintentar',
  cambiarUbicacion: 'datos:cambiarUbicacion',
  abrirExistente: 'datos:abrirExistente',
  buscarBase: 'datos:buscarBase',
  mostrarEnCarpeta: 'datos:mostrarEnCarpeta'
} as const

export type EstadoDatos =
  | { tipo: 'lista'; ruta: string }
  | { tipo: 'ausente'; ruta: string }
  | { tipo: 'error'; ruta: string; mensaje: string }

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
}
