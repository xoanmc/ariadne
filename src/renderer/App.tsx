import { useState } from 'react'
import type { RespuestaEco } from '../compartido/ipc'

export function App() {
  const [respuesta, setRespuesta] = useState<RespuestaEco | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function probar() {
    setError(null)
    try {
      setRespuesta(await window.ariadne.eco({ texto: '  Hola   desde la interfaz  ' }))
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  return (
    <main style={{ fontFamily: 'system-ui, sans-serif', padding: '2rem', color: '#2b2a27' }}>
      <h1>Ariadne</h1>
      <button onClick={probar}>Probar comunicación</button>
      {respuesta && (
        <pre>{JSON.stringify(respuesta, null, 2)}</pre>
      )}
      {error && <p style={{ color: '#b3261e' }}>{error}</p>}
    </main>
  )
}
