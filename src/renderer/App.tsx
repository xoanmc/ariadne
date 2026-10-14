import { useCallback, useEffect, useRef, useState } from 'react'
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
  | { tipo: 'registro'; alumnoId: number | null; sesionId?: number }
  | { tipo: 'alta' }
  | { tipo: 'ficha'; id: number; recienCreado: boolean }
  | { tipo: 'curso'; cursoId: number; recienAbierto: boolean; aviso?: string }
  | { tipo: 'cierre'; trimestreId: number }
  | { tipo: 'copias' }
  | { tipo: 'opciones' }
  | { tipo: 'calendario' }

/** Al volver a una pantalla, sus avisos de entonces ya no vienen a cuento. */
function sinAvisos(vista: Vista): Vista {
  switch (vista.tipo) {
    case 'alumnos':
      return { tipo: 'alumnos' }
    case 'curso':
      return { tipo: 'curso', cursoId: vista.cursoId, recienAbierto: false }
    case 'ficha':
      return { tipo: 'ficha', id: vista.id, recienCreado: false }
    default:
      return vista
  }
}

const misma = (a: Vista, b: Vista) => JSON.stringify(sinAvisos(a)) === JSON.stringify(sinAvisos(b))

export function App() {
  const [estado, setEstado] = useState<EstadoDatos | null>(null)
  // Como en un navegador: la última es la que se ve, y "Atrás" vuelve a la anterior
  const [historial, setHistorial] = useState<Vista[]>([{ tipo: 'alumnos' }])
  // El registro avisa de si tiene algo escrito sin guardar; salir de él entonces pide confirmación
  const registroSinGuardar = useRef(false)
  const [pendiente, setPendiente] = useState<(() => void) | null>(null)

  useEffect(() => {
    window.ariadne.datos.estado().then(setEstado)
  }, [])

  const vista = historial[historial.length - 1]

  /** Cualquier salida de la pantalla actual que no sea guardar pasa por aquí. */
  const salir = useCallback(
    (accion: () => void) => {
      if (vista.tipo === 'registro' && registroSinGuardar.current) return setPendiente(() => accion)
      accion()
    },
    [vista]
  )

  const ir = (nueva: Vista) => salir(() => setHistorial((h) => (misma(h[h.length - 1], nueva) ? h : [...h, nueva])))
  /** Tras guardar: la pantalla del formulario se sustituye, para que "Atrás" no vuelva a él. */
  const sustituir = (nueva: Vista) => setHistorial((h) => [...h.slice(0, -1), nueva])
  /** Tras guardar, vuelve a donde estaba antes del formulario, con el aviso de lo hecho. */
  const volverCon = (aviso: string) =>
    setHistorial((h) => {
      const anterior = h.length > 1 ? h[h.length - 2] : ({ tipo: 'alumnos' } as Vista)
      const conAviso = anterior.tipo === 'alumnos' || anterior.tipo === 'curso' ? { ...sinAvisos(anterior), aviso } : sinAvisos(anterior)
      return [...h.slice(0, -2), conAviso]
    })
  const atras = useCallback(
    () => salir(() => setHistorial((h) => (h.length > 1 ? [...h.slice(0, -2), sinAvisos(h[h.length - 2])] : h))),
    [salir]
  )

  // También con el botón de atrás del ratón y con Alt + ←, lo habitual en Windows
  useEffect(() => {
    const raton = (evento: MouseEvent) => {
      if (evento.button !== 3) return
      evento.preventDefault()
      atras()
    }
    const teclado = (evento: KeyboardEvent) => {
      if (!evento.altKey || evento.key !== 'ArrowLeft') return
      evento.preventDefault()
      atras()
    }
    window.addEventListener('mouseup', raton)
    window.addEventListener('keydown', teclado)
    return () => {
      window.removeEventListener('mouseup', raton)
      window.removeEventListener('keydown', teclado)
    }
  }, [atras])

  if (!estado) return null
  if (estado.tipo !== 'lista') return <PantallaSinDatos estado={estado} onEstado={setEstado} />

  const enEsquina = vista.tipo === 'copias' || vista.tipo === 'opciones' || vista.tipo === 'calendario'
  const esquina = (tipo: 'calendario' | 'opciones' | 'copias', texto: string) => (
    <button className={vista.tipo === tipo ? 'enlace discreto activo' : 'enlace discreto'} onClick={() => ir({ tipo })}>
      {texto}
    </button>
  )

  return (
    <>
      <header className="barra">
        <button className="enlace atras" onClick={atras} disabled={historial.length <= 1} title="Atrás (Alt + ←)">
          ← Atrás
        </button>
        <span className="marca">Ariadne</span>
        <nav>
          <button className={enEsquina ? 'enlace' : 'enlace activo'} onClick={() => ir({ tipo: 'alumnos' })}>
            Alumnos
          </button>
        </nav>
        {esquina('calendario', 'Calendario')}
        {esquina('opciones', 'Opciones del registro')}
        {esquina('copias', 'Copias de seguridad')}
      </header>

      {pendiente && (
        <div className="banda-aviso confirmar-salida" role="alertdialog" aria-label="Salir sin guardar">
          <span>Tienes una sesión sin guardar. ¿Salir sin guardarla?</span>
          <button
            onClick={() => {
              registroSinGuardar.current = false
              pendiente()
              setPendiente(null)
            }}
          >
            Salir sin guardar
          </button>
          <button className="principal" onClick={() => setPendiente(null)}>
            Seguir con la sesión
          </button>
        </div>
      )}

      {/* La pantalla de copias ya no es la de inicio: si la copia de hoy falla, el aviso tiene que verse igual */}
      {estado.avisoCopia && vista.tipo !== 'copias' && (
        <p className="banda-aviso">
          {estado.avisoCopia}{' '}
          <button className="enlace" onClick={() => ir({ tipo: 'copias' })}>
            Ver copias de seguridad
          </button>
        </p>
      )}

      {vista.tipo === 'alumnos' && (
        <PantallaAlumnos
          key={historial.length}
          aviso={vista.aviso}
          onAbrir={(id) => ir({ tipo: 'ficha', id, recienCreado: false })}
          onAlta={() => ir({ tipo: 'alta' })}
          onRegistrar={(alumnoId) => ir({ tipo: 'registro', alumnoId })}
        />
      )}
      {vista.tipo === 'alta' && (
        <PantallaAlta onCreado={(id) => sustituir({ tipo: 'ficha', id, recienCreado: true })} onCancelar={atras} />
      )}
      {vista.tipo === 'ficha' && (
        <PantallaFicha
          key={`${vista.id}-${historial.length}`}
          id={vista.id}
          recienCreado={vista.recienCreado}
          onVolver={atras}
          onAbrirCurso={(cursoId, recienAbierto) => ir({ tipo: 'curso', cursoId, recienAbierto })}
        />
      )}
      {vista.tipo === 'curso' && (
        <PantallaCurso
          key={`${vista.cursoId}-${historial.length}`}
          cursoId={vista.cursoId}
          recienAbierto={vista.recienAbierto}
          aviso={vista.aviso}
          onRegistrar={(alumnoId) => ir({ tipo: 'registro', alumnoId })}
          onCorregirSesion={(sesionId) => ir({ tipo: 'registro', alumnoId: null, sesionId })}
          onCerrarTrimestre={(trimestreId) => ir({ tipo: 'cierre', trimestreId })}
        />
      )}
      {vista.tipo === 'cierre' && <PantallaCierre trimestreId={vista.trimestreId} onCerrado={volverCon} />}
      {vista.tipo === 'registro' && (
        <PantallaRegistro
          key={`${vista.sesionId ?? 'nueva'}-${historial.length}`}
          alumnoId={vista.alumnoId}
          sesionId={vista.sesionId}
          onSinGuardar={(sinGuardar) => (registroSinGuardar.current = sinGuardar)}
          onRegistrada={(resumen) => {
            registroSinGuardar.current = false
            volverCon(resumen)
          }}
          onCancelar={() => {
            // Cancelar es una decisión explícita: no hace falta preguntar
            registroSinGuardar.current = false
            atras()
          }}
          onOpciones={() => ir({ tipo: 'opciones' })}
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
