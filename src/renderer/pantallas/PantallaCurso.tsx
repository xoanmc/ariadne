import { useEffect, useState } from 'react'
import type { DatosCurso, FichaAlumno, ProblemaCurso, VistaCurso } from '../../compartido/ipc'
import { EvaluacionInicial } from '../componentes/EvaluacionInicial'
import { FormularioCurso, NOMBRE_TRIMESTRE } from '../componentes/FormularioCurso'
import { fechaCorta } from '../fechas'

interface Props {
  cursoId: number
  recienAbierto: boolean
  onVolver: (alumnoId: number) => void
}

/** Todo lo de un curso. Uno cerrado se consulta igual, pero ya no se modifica. */
export function PantallaCurso({ cursoId, recienAbierto, onVolver }: Props) {
  const [curso, setCurso] = useState<VistaCurso | null | undefined>(undefined)
  const [alumno, setAlumno] = useState<FichaAlumno | null>(null)
  const [corrigiendo, setCorrigiendo] = useState(false)
  const [problemas, setProblemas] = useState<ProblemaCurso[]>([])
  const [rechazo, setRechazo] = useState<string | null>(null)
  const [confirmacion, setConfirmacion] = useState<string | null>(
    recienAbierto ? 'Curso abierto, con sus tres trimestres. Ya puedes registrar su evaluación inicial.' : null
  )
  const [ocupado, setOcupado] = useState(false)

  useEffect(() => {
    window.ariadne.cursos.obtener(cursoId).then(async (encontrado) => {
      setCurso(encontrado)
      if (encontrado) setAlumno(await window.ariadne.alumnos.obtener(encontrado.alumnoId))
    })
  }, [cursoId])

  async function corregir(datos: DatosCurso) {
    setOcupado(true)
    const resultado = await window.ariadne.cursos.corregir(cursoId, datos)
    setOcupado(false)

    if (resultado.tipo === 'invalido') return setProblemas(resultado.problemas)
    if (resultado.tipo === 'rechazado') return setRechazo(resultado.mensaje)
    setCurso(resultado.curso)
    setCorrigiendo(false)
    setConfirmacion('Cambios guardados.')
  }

  if (curso === undefined) return null
  if (curso === null) {
    return (
      <main className="pantalla">
        <p className="aviso">Este curso no existe.</p>
      </main>
    )
  }

  const activo = curso.estado === 'activo'

  return (
    <main className="pantalla">
      <button className="volver" onClick={() => onVolver(curso.alumnoId)}>
        ← {alumno ? `${alumno.nombre} ${alumno.apellidos}` : 'Alumno'}
      </button>

      <div className="cabecera-ficha">
        <h1>Curso {curso.curso}</h1>
        {alumno && <span className="codigo codigo-grande">{alumno.codigoInterno}</span>}
        <span className={activo ? 'etiqueta' : 'etiqueta etiqueta-apagada'}>{curso.estado}</span>
      </div>
      <p className="apunte">
        {curso.nivelEducativo ?? 'Nivel educativo sin indicar'}
        {curso.cursoAnterior && ` · continúa el curso ${curso.cursoAnterior}`}
      </p>
      {!activo && <p className="apunte">Este curso está cerrado: se puede consultar, pero ya no se modifica.</p>}

      {confirmacion && !corrigiendo && <p className="confirmacion">{confirmacion}</p>}

      <section className="seccion">
        <h2>Trimestres</h2>
        {corrigiendo ? (
          <>
            <FormularioCurso
              alumnoId={curso.alumnoId}
              modo="corregir"
              inicial={{
                curso: curso.curso,
                nivelEducativo: curso.nivelEducativo,
                periodos: curso.trimestres.map(({ numero, fechaInicio, fechaFin }) => ({ numero, fechaInicio, fechaFin }))
              }}
              cursoAnterior={null}
              problemas={problemas}
              ocupado={ocupado}
              onGuardar={corregir}
              onCancelar={() => setCorrigiendo(false)}
            />
            {rechazo && <p className="aviso">{rechazo}</p>}
          </>
        ) : (
          <>
            <ul className="lista-trimestres">
              {curso.trimestres.map((t) => (
                <li key={t.id}>
                  <span className="nombre-trimestre">{NOMBRE_TRIMESTRE[t.numero]}</span>
                  <span>
                    del {fechaCorta(t.fechaInicio)} al {fechaCorta(t.fechaFin)}
                  </span>
                  {t.estado === 'cerrado' && <span className="etiqueta etiqueta-apagada">cerrado</span>}
                </li>
              ))}
            </ul>
            {activo && (
              <div className="acciones">
                <button
                  onClick={() => {
                    setProblemas([])
                    setRechazo(null)
                    setConfirmacion(null)
                    setCorrigiendo(true)
                  }}
                >
                  Corregir fechas o nivel
                </button>
              </div>
            )}
          </>
        )}
      </section>

      <section className="seccion">
        <EvaluacionInicial cursoId={curso.id} editable={activo} />
      </section>
    </main>
  )
}
