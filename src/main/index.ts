import { app, BrowserWindow } from 'electron'
import { join } from 'node:path'
import { registrarManejadoresIpc } from './ipc/registrar'

function crearVentana(): void {
  const ventana = new BrowserWindow({
    width: 1100,
    height: 760,
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
  registrarManejadoresIpc()
  crearVentana()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) crearVentana()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
