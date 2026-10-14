import { useEffect, useState } from 'react'
import type { EstadoDatos } from '../compartido/ipc'
import { PantallaAlta } from './pantallas/PantallaAlta'
import { PantallaAlumnos } from './pantallas/PantallaAlumnos'
import { PantallaCalendario } from './pantallas/PantallaCalendario'
import { PantallaCierre } from './pantallas/PantallaCierre'
import { PantallaCopias } from './pantallas/PantallaCopias'
import { PantallaCurso } from './pantallas/PantallaCurso'
import { PantallaFicha } from './pantallas/PantallaFicha'
import { PantallaOpciones } from './pantallas/PantallaOpciones'
import { PantallaRegistro } from './pantallas/PantallaRegistro'
import { PantallaSinDatos } from './pantallas/PantallaSinDatos'

type Vista =
  | { tipo: 'alumnos'; aviso?: string }
  | { tipo: 'registro'; alumnoId: number | null; sesionId?: number; cursoVuelta?: number }
  | { tipo: 'alta' }
  | { tipo: 'ficha'; id: number; recienCreado: boolean }
  | { tipo: 'curso'; cursoId: number; recienAbierto: boolean; aviso?: string }
  | { tipo: 'cierre'; trimestreId: number }
  | { tipo: 'copias' }
  | { tipo: 'opciones' }
  | { tipo: 'calendario' }

export function App() {
  const [estado, setEstado] = useState<EstadoDatos | null>(null)
  const [vista, setVista] = useState<Vista>({ tipo: 'alumnos' })

  useEffect(() => {
    window.ariadne.datos.estado().then(setEstado)
  }, [])

  if (!estado) return null
  if (estado.tipo !== 'lista') return <PantallaSinDatos estado={estado} onEstado={setEstado} />

  const alumnos = () => setVista({ tipo: 'alumnos' })
  const enEsquina = vista.tipo === 'copias' || vista.tipo === 'opciones' || vista.tipo === 'calendario'

  return (
    <>
      <header className="barra">
        <span className="marca">Ariadne</span>
        <nav>
          <button className={enEsquina ? 'enlace' : 'enlace activo'} onClick={alumnos}>
            Alumnos
          </button>
        </nav>
        <button
          className={vista.tipo === 'calendario' ? 'enlace discreto activo' : 'enlace discreto'}
          onClick={() => setVista({ tipo: 'calendario' })}
        >
          Calendario
        </button>
        <button
          className={vista.tipo === 'opciones' ? 'enlace discreto activo' : 'enlace discreto'}
          onClick={() => setVista({ tipo: 'opciones' })}
        >
          Opciones del registro
        </button>
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
          aviso={vista.aviso}
          onAbrir={(id) => setVista({ tipo: 'ficha', id, recienCreado: false })}
          onAlta={() => setVista({ tipo: 'alta' })}
          onRegistrar={(alumnoId) => setVista({ tipo: 'registro', alumnoId })}
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
          aviso={vista.aviso}
          onVolver={(alumnoId) => setVista({ tipo: 'ficha', id: alumnoId, recienCreado: false })}
          onRegistrar={(alumnoId) => setVista({ tipo: 'registro', alumnoId })}
          onCorregirSesion={(sesionId, cursoId) => setVista({ tipo: 'registro', alumnoId: null, sesionId, cursoVuelta: cursoId })}
          onCerrarTrimestre={(trimestreId) => setVista({ tipo: 'cierre', trimestreId })}
        />
      )}
      {vista.tipo === 'cierre' && (
        <PantallaCierre
          trimestreId={vista.trimestreId}
          onVolver={(cursoId, aviso) => setVista({ tipo: 'curso', cursoId, recienAbierto: false, aviso })}
        />
      )}
      {vista.tipo === 'registro' && (
        <PantallaRegistro
          key={vista.sesionId ?? 'nueva'}
          alumnoId={vista.alumnoId}
          sesionId={vista.sesionId}
          onRegistrada={(resumen) =>
            setVista(
              vista.cursoVuelta !== undefined
                ? { tipo: 'curso', cursoId: vista.cursoVuelta, recienAbierto: false, aviso: resumen }
                : { tipo: 'alumnos', aviso: resumen }
            )
          }
          onCancelar={() =>
            vista.cursoVuelta !== undefined ? setVista({ tipo: 'curso', cursoId: vista.cursoVuelta, recienAbierto: false }) : alumnos()
          }
          onOpciones={() => setVista({ tipo: 'opciones' })}
        />
      )}
      {vista.tipo === 'opciones' && <PantallaOpciones />}
      {vista.tipo === 'calendario' && <PantallaCalendario />}
      {vista.tipo === 'copias' && (
        <PantallaCopias ruta={estado.ruta} avisoCopia={estado.avisoCopia} onEstado={setEstado} />
      )}
    </>
  )
}
