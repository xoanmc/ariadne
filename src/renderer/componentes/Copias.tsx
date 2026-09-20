import { useEffect, useState } from 'react'
import type { Copia, ResultadoCopia, ResultadoRestauracion } from '../../compartido/ipc'

interface Props {
  aviso?: string
  onRestaurada: () => void
}

function fechaLegible(iso: string): string {
  return new Date(iso).toLocaleString('es-ES', { dateStyle: 'full', timeStyle: 'medium' })
}

function tamanoLegible(bytes: number): string {
  const kb = bytes / 1024
  return kb < 1024 ? `${Math.round(kb)} KB` : `${(kb / 1024).toFixed(1)} MB`
}

export function Copias({ aviso, onRestaurada }: Props) {
  const [copias, setCopias] = useState<Copia[]>([])
  const [confirmando, setConfirmando] = useState<Copia | null>(null)
  const [resultado, setResultado] = useState<ResultadoCopia | ResultadoRestauracion | null>(null)
  const api = window.ariadne.copias

  useEffect(() => {
    api.listar().then(setCopias)
  }, [])

  async function tras(peticion: Promise<ResultadoCopia | ResultadoRestauracion>) {
    const nuevo = await peticion
    setResultado(nuevo)
    setConfirmando(null)
    setCopias(await api.listar())
    if (nuevo.tipo === 'restaurada') onRestaurada()
  }

  return (
    <section className="seccion">
      <h2>Copias de seguridad</h2>
      <p>
        Ariadne guarda una copia cada vez que abres la aplicación y conserva las diez últimas, junto a tus datos.
      </p>
      {aviso && <p className="aviso">{aviso}</p>}

      <div className="acciones">
        <button onClick={() => tras(api.guardar())}>Guardar una copia…</button>
        <button onClick={() => tras(api.restaurarDesdeFichero())}>Restaurar desde un fichero…</button>
      </div>

      {copias.length === 0 ? (
        <p className="apunte">Todavía no hay ninguna copia. Se creará la próxima vez que abras Ariadne.</p>
      ) : (
        <ul className="copias">
          {copias.map((copia) => (
            <li key={copia.ruta}>
              <span>
                {fechaLegible(copia.fecha)} <span className="apunte">({tamanoLegible(copia.tamano)})</span>
              </span>
              <button onClick={() => setConfirmando(copia)}>Restaurar</button>
            </li>
          ))}
        </ul>
      )}

      {confirmando && (
        <div className="pregunta">
          <p>
            Vas a volver a los datos del <strong>{fechaLegible(confirmando.fecha)}</strong>. Se perderá lo que hayas
            registrado después.
          </p>
          <p>Antes de hacerlo, Ariadne guardará una copia de lo que tienes ahora, por si te arrepientes.</p>
          <div className="acciones">
            <button className="principal" onClick={() => tras(api.restaurar(confirmando.ruta))}>
              Restaurar esa copia
            </button>
            <button onClick={() => setConfirmando(null)}>Cancelar</button>
          </div>
        </div>
      )}

      {resultado?.tipo === 'guardada' && <p className="confirmacion">Copia guardada en {resultado.ruta}</p>}
      {resultado?.tipo === 'restaurada' && (
        <p className="confirmacion">
          Datos restaurados. Lo que tenías antes quedó guardado como una copia más, la más reciente de la lista.
        </p>
      )}
      {resultado?.tipo === 'error' && <p className="aviso">{resultado.mensaje}</p>}
    </section>
  )
}
