import { useState, type ReactNode } from 'react'

interface Props {
  titulo: string
  /** Una línea con lo que hay dentro, para no tener que abrirlo: "7 objetivos", "2 actas". */
  resumen?: string | null
  abiertoAlEntrar?: boolean
  children: ReactNode
}

/**
 * Un apartado de la pantalla del curso que se abre y se cierra (T8.2). Lo de dentro se carga igual
 * aunque esté cerrado, para que el resumen del título esté al día.
 */
export function Desplegable({ titulo, resumen, abiertoAlEntrar = false, children }: Props) {
  const [abierto, setAbierto] = useState(abiertoAlEntrar)
  return (
    <section className="seccion desplegable">
      <details open={abierto} onToggle={(e) => setAbierto(e.currentTarget.open)}>
        <summary>
          <h2>{titulo}</h2>
          {resumen && <span className="resumen-desplegable">{resumen}</span>}
        </summary>
        <div className="contenido-desplegable">{children}</div>
      </details>
    </section>
  )
}
