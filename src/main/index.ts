import { app, BrowserWindow, screen } from 'electron'
import { join } from 'node:path'
import { registrarManejadoresIpc } from './ipc/registrar'
import { MIGRACIONES } from './persistencia/catalogoMigraciones'
import { UbicacionDatos } from './servicios/ubicacionDatos'

function crearVentana(): void {
  // Proporcional a la pantalla: en un portátil la llena casi entera, en una pantalla grande no queda enorme
  const { width: ancho, height: alto } = screen.getPrimaryDisplay().workAreaSize
  const ventana = new BrowserWindow({
    width: Math.min(1280, Math.round(ancho * 0.9)),
    height: Math.min(900, Math.round(alto * 0.9)),
    // Por debajo de esto la interfaz ya no cabe bien
    minWidth: 640,
    minHeight: 520,
    title: 'Ariadne',
    backgroundColor: '#f7f6f3',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  })

  ventana.removeMenu()

  if (!app.isPackaged && process.env['ELECTRON_RENDERER_URL']) {
    ventana.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    ventana.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  const datos = new UbicacionDatos(app.getPath('userData'), MIGRACIONES)
  datos.iniciar()
  app.on('will-quit', () => datos.cerrar())

  registrarManejadoresIpc(datos)
  crearVentana()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) crearVentana()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
