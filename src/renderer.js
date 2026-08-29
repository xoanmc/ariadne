const estado = document.getElementById('estado')
const estadoTexto = document.getElementById('estadoTexto')
const ruta = document.getElementById('ruta')
const contenido = document.getElementById('contenido')

async function comprobar () {
  estado.className = 'estado'
  estadoTexto.textContent = 'Comprobando…'

  const resultado = await window.ariadne.escribir()

  estado.className = resultado.ok ? 'estado ok' : 'estado error'
  estado.querySelector('.punto').textContent = resultado.ok ? '●' : '▲'
  estadoTexto.textContent = resultado.ok
    ? 'La aplicación abre y puede escribir en disco.'
    : 'No ha podido escribir el fichero.'

  ruta.textContent = resultado.ruta
  contenido.textContent = resultado.ok ? resultado.contenido : resultado.error
}

document.getElementById('reintentar').addEventListener('click', comprobar)
document.getElementById('carpeta').addEventListener('click', () => window.ariadne.abrirCarpeta())

const v = window.ariadne.versiones
document.getElementById('versiones').textContent =
  `Electron ${v.electron} · Chromium ${v.chrome} · Node ${v.node}`

comprobar()
