import { BrowserWindow, dialog, ipcMain, shell, type IpcMainInvokeEvent } from 'electron'
import { CANALES, type ResultadoCambio } from '../../compartido/ipc'
import type { UbicacionDatos } from '../servicios/ubicacionDatos'

function ventanaDe(evento: IpcMainInvokeEvent): BrowserWindow {
  const ventana = BrowserWindow.fromWebContents(evento.sender)
  if (!ventana) throw new Error('Petición sin ventana de origen')
  return ventana
}

export function registrarManejadoresIpc(datos: UbicacionDatos): void {
  ipcMain.handle(CANALES.estado, () => datos.estado)

  ipcMain.handle(CANALES.reintentar, () => datos.reintentar())

  ipcMain.handle(CANALES.cambiarUbicacion, async (evento): Promise<ResultadoCambio> => {
    const eleccion = await dialog.showOpenDialog(ventanaDe(evento), {
      title: 'Elige la carpeta donde guardar tus datos',
      buttonLabel: 'Guardar aquí',
      properties: ['openDirectory', 'createDirectory']
    })
    if (eleccion.canceled || eleccion.filePaths.length === 0) return { tipo: 'cancelado' }
    return datos.moverA(eleccion.filePaths[0])
  })

  ipcMain.handle(CANALES.abrirExistente, () => datos.abrirExistente())

  ipcMain.handle(CANALES.buscarBase, async (evento): Promise<ResultadoCambio> => {
    const eleccion = await dialog.showOpenDialog(ventanaDe(evento), {
      title: 'Busca tu base de datos de Ariadne',
      buttonLabel: 'Abrir',
      properties: ['openFile'],
      filters: [
        { name: 'Base de datos de Ariadne', extensions: ['sqlite'] },
        { name: 'Todos los ficheros', extensions: ['*'] }
      ]
    })
    if (eleccion.canceled || eleccion.filePaths.length === 0) return { tipo: 'cancelado' }
    return datos.abrir(eleccion.filePaths[0])
  })

  ipcMain.handle(CANALES.mostrarEnCarpeta, () => {
    shell.showItemInFolder(datos.estado.ruta)
  })
}
