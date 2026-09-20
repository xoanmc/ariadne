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
  },
  copias: {
    listar: () => ipcRenderer.invoke(CANALES.listarCopias),
    guardar: () => ipcRenderer.invoke(CANALES.guardarCopia),
    restaurar: (ruta) => ipcRenderer.invoke(CANALES.restaurarCopia, ruta),
    restaurarDesdeFichero: () => ipcRenderer.invoke(CANALES.restaurarDesdeFichero)
  }
}

contextBridge.exposeInMainWorld('ariadne', api)
