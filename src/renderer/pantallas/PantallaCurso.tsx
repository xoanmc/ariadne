import { useEffect, useState } from 'react'
import type { DatosCurso, FichaAlumno, ProblemaCurso, VistaCurso, VistaPrograma } from '../../compartido/ipc'
import { Actas } from '../componentes/Actas'
import { EvaluacionInicial } from '../componentes/EvaluacionInicial'
import { FormularioCurso } from '../componentes/FormularioCurso'
import { Desplegable } from '../componentes/Desplegable'
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
  const [resumenes, setResumenes] = useState<Record<'sesiones' | 'evaluacion' | 'actas', string | null>>({
    sesiones: null,
    evaluacion: null,
    actas: null
  })
  const resumir = (apartado: 'sesiones' | 'evaluacion' | 'actas', texto: string) =>
    setResumenes((actuales) => (actuales[apartado] === texto ? actuales : { ...actuales, [apartado]: texto }))

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
  // El programa ya está cargado aquí: su resumen no necesita que el apartado lo cuente
  const objetivos = programa ? new Set(programa.asignaciones.map((a) => a.objetivoId)).size : 0
  const resumenPrograma =
    programa === undefined ? null : programa === null ? 'sin programa' : objetivos === 1 ? '1 objetivo' : `${objetivos} objetivos`

  return (
    <main className="pantalla">
      {/* De quién es, en grande; el curso, debajo */}
      <div className="cabecera-ficha">
        <h1>{alumno ? `${alumno.nombre} ${alumno.apellidos}` : 'Curso'}</h1>
        {alumno && <span className="codigo codigo-grande">{alumno.codigoInterno}</span>}
      </div>
      <p className="curso-del-alumno">
        <span>Curso {curso.curso}</span>
        <span className={activo ? 'etiqueta' : 'etiqueta etiqueta-apagada'}>{curso.estado}</span>
      </p>
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

      {activo && programa !== undefined && <TrimestreEnCurso curso={curso} programa={programa} onCerrar={onCerrarTrimestre} />}

      {/* Todo cerrado salvo Sesiones, que es lo que más usa (T8.2) */}
      <Desplegable titulo="Evaluación inicial" resumen={resumenes.evaluacion}>
        <EvaluacionInicial cursoId={curso.id} editable={activo} onResumen={(r) => resumir('evaluacion', r)} />
      </Desplegable>

      <Desplegable titulo="Sesiones" resumen={resumenes.sesiones} abiertoAlEntrar>
        <SesionesDelCurso
          curso={curso}
          onCorregir={onCorregirSesion}
          onRegistrar={activo ? () => onRegistrar(curso.alumnoId) : undefined}
          onResumen={(r) => resumir('sesiones', r)}
        />
      </Desplegable>

      <Desplegable titulo="Programa de intervención" resumen={resumenPrograma}>
        <Programa
          cursoId={curso.id}
          trimestres={curso.trimestres}
          editable={activo}
          programa={programa}
          onPrograma={setPrograma}
        />
      </Desplegable>

      <Desplegable titulo="Actas de reunión" resumen={resumenes.actas}>
        <Actas cursoId={curso.id} editable={activo} onResumen={(r) => resumir('actas', r)} />
      </Desplegable>
    </main>
  )
}
