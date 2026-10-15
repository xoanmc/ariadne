import { useState } from 'react'

/** Llevarse todos sus datos (T7.1, P1): la base para recuperarlo todo y una versión legible sin Ariadne. */
export function ExportarDatos() {
  const [carpeta, setCarpeta] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)

  async function exportar() {
    setOcupado(true)
    setCarpeta(null)
    setError(null)
    const resultado = await window.ariadne.exportacion.datosCompletos()
    setOcupado(false)
    if (resultado.tipo === 'rechazado') return setError(resultado.mensaje)
    if (resultado.tipo === 'exportados') setCarpeta(resultado.carpeta)
  }

  return (
    <section className="seccion">
      <h2>Llevarte todos tus datos</h2>
      <p>
        Guarda en una carpeta todo lo que has registrado: la base de datos completa, para recuperarla en Ariadne, y los
        mismos datos en un formato abierto que se lee sin la aplicación.
      </p>
      <div className="acciones">
        <button onClick={exportar} disabled={ocupado}>
          Exportar todos mis datos
        </button>
      </div>
      {carpeta && (
        <p className="confirmacion">
          Guardados en <span className="ruta-breve">{carpeta}</span>{' '}
          <button className="enlace" onClick={() => window.ariadne.exportacion.mostrar()}>
            Abrir la carpeta
          </button>
        </p>
      )}
      {error && <p className="aviso">{error}</p>}
    </section>
  )
}
