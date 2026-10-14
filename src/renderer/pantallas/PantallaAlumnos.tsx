import { useEffect, useState, type KeyboardEvent } from 'react'
import { coincideBusqueda } from '../../compartido/busqueda'
import type { AlumnoEnLista } from '../../compartido/ipc'
import { ExportarTodos } from '../componentes/ExportarTodos'

interface Props {
  aviso?: string
  onAbrir: (id: number) => void
  onAlta: () => void
  onRegistrar: (id: number) => void
}

interface PropsFila {
  alumno: AlumnoEnLista
  onAbrir: (id: number) => void
  onRegistrar: (id: number) => void
  marcarSinCurso?: boolean
}

function Fila({ alumno, onAbrir, onRegistrar, marcarSinCurso = false }: PropsFila) {
  return (
    <li className="fila-con-accion">
      <button className="fila-alumno" onClick={() => onAbrir(alumno.id)}>
        <span className="nombre-alumno">
          {alumno.nombre} {alumno.apellidos}
        </span>
        <span className="detalle-alumno">
          {alumno.cursoActivo?.nivelEducativo && <span className="nivel">{alumno.cursoActivo.nivelEducativo}</span>}
          {marcarSinCurso && !alumno.cursoActivo && <span className="etiqueta etiqueta-apagada">sin curso activo</span>}
          <span className="codigo">{alumno.codigoInterno}</span>
        </span>
      </button>
      {alumno.cursoActivo && (
        <button className="registrar" onClick={() => onRegistrar(alumno.id)}>
          Registrar sesión
        </button>
      )}
    </li>
  )
}

export function PantallaAlumnos({ aviso, onAbrir, onAlta, onRegistrar }: Props) {
  const [alumnos, setAlumnos] = useState<AlumnoEnLista[] | null>(null)
  const [consulta, setConsulta] = useState('')
  const [verSinCurso, setVerSinCurso] = useState(false)

  useEffect(() => {
    window.ariadne.alumnos.listar().then(setAlumnos)
  }, [])

  if (!alumnos) return null

  const buscando = consulta.trim() !== ''
  const resultados = alumnos.filter((a) => coincideBusqueda(a, consulta))
  const activos = alumnos.filter((a) => a.cursoActivo)
  const sinCurso = alumnos.filter((a) => !a.cursoActivo)
  // Si nadie tiene curso activo (recién empezado, o en septiembre), los demás no pueden quedar escondidos
  const sinCursoVisible = verSinCurso || activos.length === 0

  function alPulsar(evento: KeyboardEvent<HTMLInputElement>) {
    if (evento.key === 'Enter' && buscando && resultados.length > 0) onAbrir(resultados[0].id)
    if (evento.key === 'Escape') setConsulta('')
  }

  return (
    <main className="pantalla">
      <div className="cabecera-pantalla">
        <h1>Alumnos</h1>
        <button className="principal" onClick={onAlta}>
          Dar de alta a un alumno
        </button>
      </div>

      {aviso && <p className="confirmacion">{aviso}</p>}

      {alumnos.length === 0 ? (
        <div className="vacio">
          <p>Todavía no hay ningún alumno.</p>
          <p className="apunte">Empieza dando de alta al primero. Solo hacen falta su nombre y sus apellidos.</p>
        </div>
      ) : (
        <>
          <input
            className="buscador"
            type="search"
            placeholder="Buscar por nombre, apellidos o código"
            aria-label="Buscar alumno"
            value={consulta}
            onChange={(e) => setConsulta(e.target.value)}
            onKeyDown={alPulsar}
            autoFocus
          />

          {buscando ? (
            resultados.length === 0 ? (
              <p className="apunte">Ningún alumno coincide con «{consulta.trim()}».</p>
            ) : (
              <>
                <p className="apunte">Pulsa Intro para abrir el primero.</p>
                <ul className="lista-alumnos">
                  {resultados.map((a) => (
                    <Fila key={a.id} alumno={a} onAbrir={onAbrir} onRegistrar={onRegistrar} marcarSinCurso />
                  ))}
                </ul>
              </>
            )
          ) : (
            <>
              {activos.length > 0 ? (
                <ul className="lista-alumnos">
                  {activos.map((a) => (
                    <Fila key={a.id} alumno={a} onAbrir={onAbrir} onRegistrar={onRegistrar} />
                  ))}
                </ul>
              ) : (
                <p className="apunte">Ningún alumno tiene ahora un curso activo. Ábreselo desde su ficha.</p>
              )}

              {sinCurso.length > 0 && (
                <section className="grupo-sin-curso">
                  {activos.length > 0 && (
                    <button className="plegable" aria-expanded={sinCursoVisible} onClick={() => setVerSinCurso(!verSinCurso)}>
                      {sinCursoVisible ? '▾' : '▸'} Sin curso activo ({sinCurso.length})
                    </button>
                  )}
                  {sinCursoVisible && (
                    <ul className="lista-alumnos">
                      {sinCurso.map((a) => (
                        <Fila key={a.id} alumno={a} onAbrir={onAbrir} onRegistrar={onRegistrar} />
                      ))}
                    </ul>
                  )}
                </section>
              )}
            </>
          )}

          {!buscando && <ExportarTodos />}
        </>
      )}
    </main>
  )
}
