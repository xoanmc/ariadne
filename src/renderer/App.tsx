import { useEffect, useState } from 'react'
import type { EstadoDatos } from '../compartido/ipc'
import { PantallaAlta } from './pantallas/PantallaAlta'
import { PantallaAlumnos } from './pantallas/PantallaAlumnos'
import { PantallaCopias } from './pantallas/PantallaCopias'
import { PantallaCurso } from './pantallas/PantallaCurso'
import { PantallaFicha } from './pantallas/PantallaFicha'
import { PantallaSinDatos } from './pantallas/PantallaSinDatos'

type Vista =
  | { tipo: 'alumnos' }
  | { tipo: 'alta' }
  | { tipo: 'ficha'; id: number; recienCreado: boolean }
  | { tipo: 'curso'; cursoId: number; recienAbierto: boolean }
  | { tipo: 'copias' }

export function App() {
  const [estado, setEstado] = useState<EstadoDatos | null>(null)
  const [vista, setVista] = useState<Vista>({ tipo: 'alumnos' })

  useEffect(() => {
    window.ariadne.datos.estado().then(setEstado)
  }, [])

  if (!estado) return null
  if (estado.tipo !== 'lista') return <PantallaSinDatos estado={estado} onEstado={setEstado} />

  const alumnos = () => setVista({ tipo: 'alumnos' })

  return (
    <>
      <header className="barra">
        <span className="marca">Ariadne</span>
        <nav>
          <button className={vista.tipo === 'copias' ? 'enlace' : 'enlace activo'} onClick={alumnos}>
            Alumnos
          </button>
        </nav>
        <button
          className={vista.tipo === 'copias' ? 'enlace discreto activo' : 'enlace discreto'}
          onClick={() => setVista({ tipo: 'copias' })}
        >
          Copias de seguridad
        </button>
      </header>

      {/* La pantalla de copias ya no es la de inicio: si la copia de hoy falla, el aviso tiene que verse igual */}
      {estado.avisoCopia && vista.tipo !== 'copias' && (
        <p className="banda-aviso">
          {estado.avisoCopia}{' '}
          <button className="enlace" onClick={() => setVista({ tipo: 'copias' })}>
            Ver copias de seguridad
          </button>
        </p>
      )}

      {vista.tipo === 'alumnos' && (
        <PantallaAlumnos
          onAbrir={(id) => setVista({ tipo: 'ficha', id, recienCreado: false })}
          onAlta={() => setVista({ tipo: 'alta' })}
        />
      )}
      {vista.tipo === 'alta' && (
        <PantallaAlta onCreado={(id) => setVista({ tipo: 'ficha', id, recienCreado: true })} onCancelar={alumnos} />
      )}
      {vista.tipo === 'ficha' && (
        <PantallaFicha
          key={vista.id}
          id={vista.id}
          recienCreado={vista.recienCreado}
          onVolver={alumnos}
          onAbrirCurso={(cursoId, recienAbierto) => setVista({ tipo: 'curso', cursoId, recienAbierto })}
        />
      )}
      {vista.tipo === 'curso' && (
        <PantallaCurso
          key={vista.cursoId}
          cursoId={vista.cursoId}
          recienAbierto={vista.recienAbierto}
          onVolver={(alumnoId) => setVista({ tipo: 'ficha', id: alumnoId, recienCreado: false })}
        />
      )}
      {vista.tipo === 'copias' && (
        <PantallaCopias ruta={estado.ruta} avisoCopia={estado.avisoCopia} onEstado={setEstado} />
      )}
    </>
  )
}
