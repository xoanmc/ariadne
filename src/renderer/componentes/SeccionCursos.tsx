import { useEffect, useState } from 'react'
import type { DatosCurso, ProblemaCurso, PropuestaCurso, ResultadoCurso, VistaCurso } from '../../compartido/ipc'
import { fechaCorta } from '../fechas'
import { EvaluacionInicial } from './EvaluacionInicial'
import { FormularioCurso, NOMBRE_TRIMESTRE } from './FormularioCurso'

interface Props {
  alumnoId: number
}

type Edicion = { modo: 'abrir'; inicial: DatosCurso; cursoAnterior: string | null } | { modo: 'corregir'; curso: VistaCurso }

export function SeccionCursos({ alumnoId }: Props) {
  const [cursos, setCursos] = useState<VistaCurso[] | null>(null)
  const [propuesta, setPropuesta] = useState<PropuestaCurso | null>(null)
  const [edicion, setEdicion] = useState<Edicion | null>(null)
  const [problemas, setProblemas] = useState<ProblemaCurso[]>([])
  const [rechazo, setRechazo] = useState<string | null>(null)
  const [confirmacion, setConfirmacion] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const api = window.ariadne.cursos

  async function cargar() {
    const [lista, siguiente] = await Promise.all([api.deAlumno(alumnoId), api.proponer(alumnoId)])
    setCursos(lista)
    setPropuesta(siguiente)
  }

  useEffect(() => {
    cargar()
  }, [alumnoId])

  function empezar(nueva: Edicion) {
    setEdicion(nueva)
    setProblemas([])
    setRechazo(null)
    setConfirmacion(null)
  }

  async function guardar(datos: DatosCurso) {
    if (!edicion) return
    setOcupado(true)
    const resultado: ResultadoCurso =
      edicion.modo === 'abrir' ? await api.abrir(alumnoId, datos) : await api.corregir(edicion.curso.id, datos)
    setOcupado(false)

    if (resultado.tipo === 'invalido') return setProblemas(resultado.problemas)
    if (resultado.tipo === 'rechazado') return setRechazo(resultado.mensaje)

    setConfirmacion(
      edicion.modo === 'abrir' ? `Curso ${resultado.curso.curso} abierto, con sus tres trimestres.` : 'Cambios guardados.'
    )
    setEdicion(null)
    await cargar()
  }

  if (!cursos || !propuesta) return null

  const activo = cursos.find((c) => c.estado === 'activo')
  const cerrados = cursos.filter((c) => c.estado === 'cerrado')

  return (
    <section className="seccion">
      <h2>Cursos</h2>

      {confirmacion && !edicion && <p className="confirmacion">{confirmacion}</p>}

      {edicion ? (
        <>
          <FormularioCurso
            alumnoId={alumnoId}
            modo={edicion.modo}
            inicial={
              edicion.modo === 'abrir'
                ? edicion.inicial
                : {
                    curso: edicion.curso.curso,
                    nivelEducativo: edicion.curso.nivelEducativo,
                    periodos: edicion.curso.trimestres.map(({ numero, fechaInicio, fechaFin }) => ({
                      numero,
                      fechaInicio,
                      fechaFin
                    }))
                  }
            }
            cursoAnterior={edicion.modo === 'abrir' ? edicion.cursoAnterior : null}
            problemas={problemas}
            ocupado={ocupado}
            onGuardar={guardar}
            onCancelar={() => setEdicion(null)}
          />
          {rechazo && <p className="aviso">{rechazo}</p>}
        </>
      ) : (
        <>
          {activo && (
            <div className="tarjeta-curso">
              <div className="cabecera-curso">
                <strong>Curso {activo.curso}</strong>
                {activo.nivelEducativo && <span>{activo.nivelEducativo}</span>}
                <span className="etiqueta">activo</span>
              </div>
              {activo.cursoAnterior && <p className="apunte">Continúa el curso {activo.cursoAnterior}.</p>}
              <ul className="lista-trimestres">
                {activo.trimestres.map((t) => (
                  <li key={t.id}>
                    <span className="nombre-trimestre">{NOMBRE_TRIMESTRE[t.numero]}</span>
                    <span>
                      del {fechaCorta(t.fechaInicio)} al {fechaCorta(t.fechaFin)}
                    </span>
                    {t.estado === 'cerrado' && <span className="etiqueta">cerrado</span>}
                  </li>
                ))}
              </ul>
              <div className="acciones">
                <button onClick={() => empezar({ modo: 'corregir', curso: activo })}>Corregir fechas o nivel</button>
              </div>
              <EvaluacionInicial cursoId={activo.id} />
            </div>
          )}

          {propuesta.tipo === 'propuesta' && (
            <>
              {cursos.length === 0 && <p>Todavía no tiene ningún curso.</p>}
              <div className="acciones">
                <button
                  className="principal"
                  onClick={() =>
                    empezar({
                      modo: 'abrir',
                      inicial: { curso: propuesta.curso, nivelEducativo: null, periodos: propuesta.periodos },
                      cursoAnterior: propuesta.cursoAnterior
                    })
                  }
                >
                  Abrir el curso {propuesta.curso}
                </button>
              </div>
            </>
          )}

          {cerrados.length > 0 && (
            <ul className="cursos-cerrados">
              {cerrados.map((c) => (
                <li key={c.id}>
                  Curso {c.curso}
                  {c.nivelEducativo && ` · ${c.nivelEducativo}`} <span className="etiqueta">cerrado</span>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  )
}
