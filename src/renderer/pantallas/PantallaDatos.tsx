import { useState } from 'react'
import type { EstadoDatos, ResultadoCambio } from '../../compartido/ipc'
import { Copias } from '../componentes/Copias'

interface Props {
  ruta: string
  avisoCopia?: string
  onEstado: (estado: EstadoDatos) => void
}

export function PantallaDatos({ ruta, avisoCopia, onEstado }: Props) {
  const [resultado, setResultado] = useState<ResultadoCambio | null>(null)
  const { datos } = window.ariadne

  async function aplicar(peticion: Promise<ResultadoCambio>) {
    const nuevo = await peticion
    setResultado(nuevo)
    if (nuevo.tipo === 'movida' || nuevo.tipo === 'abierta') onEstado(await datos.estado())
  }

  return (
    <main className="pantalla">
      <h1>Tus datos</h1>
      <p>Ariadne guarda todo en un único fichero:</p>
      <p className="ruta">{ruta}</p>
      <div className="acciones">
        <button onClick={() => datos.mostrarEnCarpeta()}>Mostrar en la carpeta</button>
        <button onClick={() => aplicar(datos.cambiarUbicacion())}>Cambiar ubicación…</button>
      </div>

      {resultado?.tipo === 'movida' && (
        <p className="confirmacion">
          Tus datos se han copiado a la nueva ubicación y Ariadne los usa desde ahora. La copia anterior sigue en su
          sitio, sin cambios.
        </p>
      )}
      {resultado?.tipo === 'abierta' && (
        <p className="confirmacion">Ariadne usa ahora la base de esa carpeta. La anterior sigue en su sitio, sin cambios.</p>
      )}
      {resultado?.tipo === 'existe' && (
        <div className="pregunta">
          <p>En esa carpeta ya hay una base de datos de Ariadne:</p>
          <p className="ruta">{resultado.ruta}</p>
          <p>No se va a sobrescribir. ¿Quieres usar esa base en lugar de la actual? Tus datos actuales no se tocan.</p>
          <div className="acciones">
            <button className="principal" onClick={() => aplicar(datos.abrirExistente())}>Usar esa base</button>
            <button onClick={() => setResultado(null)}>Cancelar</button>
          </div>
        </div>
      )}
      {resultado?.tipo === 'error' && <p className="aviso">{resultado.mensaje}</p>}

      <Copias aviso={avisoCopia} onRestaurada={async () => onEstado(await datos.estado())} />
    </main>
  )
}
