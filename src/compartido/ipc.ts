export const CANALES = {
  eco: 'sistema:eco'
} as const

export interface PeticionEco {
  texto: string
}

export interface RespuestaEco {
  texto: string
  recibidoEn: string
  version: string
}

export interface AriadneApi {
  eco(peticion: PeticionEco): Promise<RespuestaEco>
}
