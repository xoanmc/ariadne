import { useEffect, useState } from 'react'
import type { DatosCurso, ProblemaCurso, PropuestaCurso, VistaCurso } from '../../compartido/ipc'
import { FormularioCurso } from './FormularioCurso'

interface Props {
  alumnoId: number
  onAbrirCurso: (cursoId: number, recienAbierto: boolean) => void
}

/** El historial del alumno: todos sus cursos, del más reciente al más antiguo, cada uno con su pantalla. */
export function SeccionCursos({ alumnoId, onAbrirCurso }: Props) {
  const [cursos, setCursos] = useState<VistaCurso[] | null>(null)
  const [propuesta, setPropuesta] = useState<PropuestaCurso | null>(null)
  const [abriendo, setAbriendo] = useState<{ inicial: DatosCurso; cursoAnterior: string | null } | null>(null)
  const [problemas, setProblemas] = useState<ProblemaCurso[]>([])
  const [rechazo, setRechazo] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const api = window.ariadne.cursos

  useEffect(() => {
    Promise.all([api.deAlumno(alumnoId), api.proponer(alumnoId)]).then(([lista, siguiente]) => {
      setCursos(lista)
      setPropuesta(siguiente)
    })
  }, [alumnoId])

  async function abrir(datos: DatosCurso) {
    setOcupado(true)
    const resultado = await api.abrir(alumnoId, datos)
    setOcupado(false)

    if (resultado.tipo === 'invalido') return setProblemas(resultado.problemas)
    if (resultado.tipo === 'rechazado') return setRechazo(resultado.mensaje)
    onAbrirCurso(resultado.curso.id, true)
  }

  if (!cursos || !propuesta) return null

  return (
    <section className="seccion">
      <h2>Cursos</h2>

      {abriendo ? (
        <>
          <FormularioCurso
            alumnoId={alumnoId}
            modo="abrir"
            inicial={abriendo.inicial}
            cursoAnterior={abriendo.cursoAnterior}
            problemas={problemas}
            ocupado={ocupado}
            onGuardar={abrir}
            onCancelar={() => setAbriendo(null)}
          />
          {rechazo && <p className="aviso">{rechazo}</p>}
        </>
      ) : (
        <>
          {cursos.length === 0 && <p>Todavía no tiene ningún curso.</p>}

          {propuesta.tipo === 'propuesta' && (
            <div className="acciones">
              <button
                className="principal"
                onClick={() => {
                  setProblemas([])
                  setRechazo(null)
                  setAbriendo({
                    inicial: { curso: propuesta.curso, nivelEducativo: null, periodos: propuesta.periodos },
                    cursoAnterior: propuesta.cursoAnterior
                  })
                }}
              >
                Abrir el curso {propuesta.curso}
              </button>
            </div>
          )}

          {cursos.length > 0 && (
            <ul className="historial">
              {cursos.map((c) => (
                <li key={c.id}>
                  <button
                    className={c.estado === 'activo' ? 'fila-curso activo' : 'fila-curso'}
                    onClick={() => onAbrirCurso(c.id, false)}
                  >
                    <span className="curso-titulo">
                      <strong>Curso {c.curso}</strong>
                      {c.nivelEducativo && <span>{c.nivelEducativo}</span>}
                    </span>
                    <span className="curso-detalle">
                      {c.cursoAnterior && <span className="apunte">continúa {c.cursoAnterior}</span>}
                      <span className={c.estado === 'activo' ? 'etiqueta' : 'etiqueta etiqueta-apagada'}>{c.estado}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  )
}
