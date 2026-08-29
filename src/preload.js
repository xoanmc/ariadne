const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('ariadne', {
  escribir: () => ipcRenderer.invoke('prueba:escribir'),
  abrirCarpeta: () => ipcRenderer.invoke('prueba:abrirCarpeta'),
  versiones: {
    electron: process.versions.electron,
    chrome: process.versions.chrome,
    node: process.versions.node
  }
})
