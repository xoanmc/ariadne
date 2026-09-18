import { contextBridge, ipcRenderer } from 'electron'
import { CANALES, type AriadneApi } from '../compartido/ipc'

const api: AriadneApi = {
  datos: {
    estado: () => ipcRenderer.invoke(CANALES.estado),
    reintentar: () => ipcRenderer.invoke(CANALES.reintentar),
    cambiarUbicacion: () => ipcRenderer.invoke(CANALES.cambiarUbicacion),
    abrirExistente: () => ipcRenderer.invoke(CANALES.abrirExistente),
    buscarBase: () => ipcRenderer.invoke(CANALES.buscarBase),
    mostrarEnCarpeta: () => ipcRenderer.invoke(CANALES.mostrarEnCarpeta)
  }
}

contextBridge.exposeInMainWorld('ariadne', api)
