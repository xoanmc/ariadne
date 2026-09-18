import { contextBridge, ipcRenderer } from 'electron'
import { CANALES, type AriadneApi } from '../compartido/ipc'

const api: AriadneApi = {
  eco: (peticion) => ipcRenderer.invoke(CANALES.eco, peticion)
}

contextBridge.exposeInMainWorld('ariadne', api)
