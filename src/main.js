// T0.1 — Prueba de viabilidad del empaquetado.
// Abre una ventana y escribe un fichero en disco. Nada más.
// Este código es desechable: existe para comprobar que el instalador
// se ejecuta en Windows.

const { app, BrowserWindow, ipcMain, shell } = require('electron')
const path = require('node:path')
const fs = require('node:fs')

const rutaFichero = () => path.join(app.getPath('userData'), 'prueba-escritura.txt')

function escribir () {
  const ruta = rutaFichero()
  const linea = `Escritura correcta — ${new Date().toLocaleString('es-ES')}\n`
  try {
    fs.mkdirSync(path.dirname(ruta), { recursive: true })
    fs.appendFileSync(ruta, linea, 'utf8')
    return { ok: true, ruta, contenido: fs.readFileSync(ruta, 'utf8') }
  } catch (error) {
    return { ok: false, ruta, error: error && error.message ? error.message : String(error) }
  }
}

function crearVentana () {
  const ventana = new BrowserWindow({
    width: 760,
    height: 620,
    title: 'Ariadne — prueba de viabilidad',
    backgroundColor: '#f7f6f3',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  ventana.removeMenu()
  ventana.loadFile(path.join(__dirname, 'index.html'))
}

ipcMain.handle('prueba:escribir', () => escribir())

ipcMain.handle('prueba:abrirCarpeta', () => {
  shell.showItemInFolder(rutaFichero())
})

app.whenReady().then(() => {
  crearVentana()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) crearVentana()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
