import { useState } from 'react'
import type { EstadoDatos } from '../../compartido/ipc'

interface Props {
  estado: Exclude<EstadoDatos, { tipo: 'lista' }>
  onEstado: (estado: EstadoDatos) => void
}

export function PantallaSinDatos({ estado, onEstado }: Props) {
  const [aviso, setAviso] = useState<string | null>(null)
  const { datos } = window.ariadne

  async function reintentar() {
    setAviso(null)
    const nuevo = await datos.reintentar()
    if (nuevo.tipo === 'ausente') setAviso('Sigo sin encontrarlos. Comprueba que el USB o disco está conectado.')
    onEstado(nuevo)
  }

  async function buscar() {
    setAviso(null)
    const resultado = await datos.buscarBase()
    if (resultado.tipo === 'error') setAviso(resultado.mensaje)
    if (resultado.tipo === 'abierta') onEstado(await datos.estado())
  }

  return (
    <main className="pantalla bloqueo">
      {estado.tipo === 'ausente' ? (
        <>
          <h1>No encuentro tus datos</h1>
          <p>Los buscaba en:</p>
          <p className="ruta">{estado.ruta}</p>
          <p>Si están en un USB o un disco externo, conéctalo y pulsa <strong>Reintentar</strong>.</p>
        </>
      ) : (
        <>
          <h1>No se pueden abrir tus datos</h1>
          <p>{estado.mensaje}</p>
          <p className="ruta">{estado.ruta}</p>
        </>
      )}
      <div className="acciones">
        <button className="principal" onClick={reintentar}>Reintentar</button>
        <button onClick={buscar}>Buscar la base en otra ubicación…</button>
      </div>
      {aviso && <p className="aviso">{aviso}</p>}
    </main>
  )
}
