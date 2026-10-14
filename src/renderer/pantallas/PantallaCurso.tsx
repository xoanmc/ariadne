import { useEffect, useState } from 'react'
import type { DatosCurso, FichaAlumno, ProblemaCurso, VistaCurso, VistaPrograma } from '../../compartido/ipc'
import { Actas } from '../componentes/Actas'
import { EvaluacionInicial } from '../componentes/EvaluacionInicial'
import { FormularioCurso } from '../componentes/FormularioCurso'
import { Programa } from '../componentes/Programa'
import { SesionesDelCurso } from '../componentes/SesionesDelCurso'
import { TrimestreEnCurso } from '../componentes/TrimestreEnCurso'

interface Props {
  cursoId: number
  recienAbierto: boolean
  aviso?: string
  onRegistrar: (alumnoId: number) => void
  onCorregirSesion: (sesionId: number) => void
  onCerrarTrimestre: (trimestreId: number) => void
}

/** Todo lo de un curso. Uno cerrado se consulta igual, pero ya no se modifica. */
export function PantallaCurso({ cursoId, recienAbierto, aviso, onRegistrar, onCorregirSesion, onCerrarTrimestre }: Props) {
  const [curso, setCurso] = useState<VistaCurso | null | undefined>(undefined)
  const [alumno, setAlumno] = useState<FichaAlumno | null>(null)
  const [programa, setPrograma] = useState<VistaPrograma | null | undefined>(undefined)
  const [corrigiendo, setCorrigiendo] = useState(false)
  const [problemas, setProblemas] = useState<ProblemaCurso[]>([])
  const [rechazo, setRechazo] = useState<string | null>(null)
  const [confirmacion, setConfirmacion] = useState<string | null>(
    recienAbierto ? 'Curso abierto, con sus tres trimestres. Ya puedes registrar su evaluación inicial.' : (aviso ?? null)
  )
  const [ocupado, setOcupado] = useState(false)

  useEffect(() => {
    window.ariadne.cursos.obtener(cursoId).then(async (encontrado) => {
      setCurso(encontrado)
      if (encontrado) {
        setAlumno(await window.ariadne.alumnos.obtener(encontrado.alumnoId))
        setPrograma(await window.ariadne.programas.deCurso(encontrado.id))
      }
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
      <div className="cabecera-ficha">
        <h1>Curso {curso.curso}</h1>
        {alumno && <span className="codigo codigo-grande">{alumno.codigoInterno}</span>}
        <span className={activo ? 'etiqueta' : 'etiqueta etiqueta-apagada'}>{curso.estado}</span>
      </div>
      <p className="apunte">
        {curso.nivelEducativo ?? 'Nivel educativo sin indicar'}
        {curso.cursoAnterior && ` · continúa el curso ${curso.cursoAnterior}`}
        {activo && !corrigiendo && (
          <>
            {' · '}
            <button
              className="enlace"
              onClick={() => {
                setProblemas([])
                setRechazo(null)
                setConfirmacion(null)
                setCorrigiendo(true)
              }}
            >
              Corregir el nivel
            </button>
          </>
        )}
      </p>
      {corrigiendo && (
        <>
          <FormularioCurso
            alumnoId={curso.alumnoId}
            modo="corregir"
            inicial={{ curso: curso.curso, nivelEducativo: curso.nivelEducativo }}
            cursoAnterior={null}
            problemas={problemas}
            ocupado={ocupado}
            onGuardar={corregir}
            onCancelar={() => setCorrigiendo(false)}
          />
          {rechazo && <p className="aviso">{rechazo}</p>}
        </>
      )}
      {!activo && <p className="apunte">Este curso está cerrado: se puede consultar, pero ya no se modifica.</p>}

      {confirmacion && !corrigiendo && <p className="confirmacion">{confirmacion}</p>}

      {activo && (
        <div className="acciones">
          <button className="principal" onClick={() => onRegistrar(curso.alumnoId)}>
            Registrar sesión
          </button>
        </div>
      )}

      {activo && programa !== undefined && <TrimestreEnCurso curso={curso} programa={programa} onCerrar={onCerrarTrimestre} />}

      <section className="seccion">
        <EvaluacionInicial cursoId={curso.id} editable={activo} />
      </section>

      <section className="seccion">
        <SesionesDelCurso curso={curso} onCorregir={onCorregirSesion} />
      </section>

      <section className="seccion">
        <Programa
          cursoId={curso.id}
          trimestres={curso.trimestres}
          editable={activo}
          programa={programa}
          onPrograma={setPrograma}
        />
      </section>

      <section className="seccion">
        <Actas cursoId={curso.id} editable={activo} />
      </section>
    </main>
  )
}
