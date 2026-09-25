import { useEffect, useState } from 'react'
import type { FichaAlumno } from '../../compartido/ipc'

interface Props {
  onAbrir: (id: number) => void
  onAlta: () => void
}

export function PantallaAlumnos({ onAbrir, onAlta }: Props) {
  const [alumnos, setAlumnos] = useState<FichaAlumno[] | null>(null)

  useEffect(() => {
    window.ariadne.alumnos.listar().then(setAlumnos)
  }, [])

  if (!alumnos) return null

  return (
    <main className="pantalla">
      <div className="cabecera-pantalla">
        <h1>Alumnos</h1>
        <button className="principal" onClick={onAlta}>
          Dar de alta a un alumno
        </button>
      </div>

      {alumnos.length === 0 ? (
        <div className="vacio">
          <p>Todavía no hay ningún alumno.</p>
          <p className="apunte">Empieza dando de alta al primero. Solo hacen falta su nombre y sus apellidos.</p>
        </div>
      ) : (
        <ul className="lista-alumnos">
          {alumnos.map((alumno) => (
            <li key={alumno.id}>
              <button className="fila-alumno" onClick={() => onAbrir(alumno.id)}>
                <span className="nombre-alumno">
                  {alumno.nombre} {alumno.apellidos}
                </span>
                <span className="codigo">{alumno.codigoInterno}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}
