import { app, ipcMain } from 'electron'
import { CANALES, type PeticionEco, type RespuestaEco } from '../../compartido/ipc'
import { normalizarEspacios } from '../dominio/texto'

export function registrarManejadoresIpc(): void {
  ipcMain.handle(CANALES.eco, (_evento, peticion: PeticionEco): RespuestaEco => ({
    texto: normalizarEspacios(peticion.texto),
    recibidoEn: new Date().toISOString(),
    version: app.getVersion()
  }))
}
