import { useState, type FormEvent } from 'react'
import type { CampoCurso, DatosCurso, NumeroTrimestre, PeriodoTrimestre, ProblemaCurso } from '../../compartido/ipc'
import { fechaCorta } from '../fechas'

export const NOMBRE_TRIMESTRE: Record<NumeroTrimestre, string> = {
  1: '1.er trimestre',
  2: '2.º trimestre',
  3: '3.er trimestre'
}

interface Props {
  alumnoId: number
  modo: 'abrir' | 'corregir'
  inicial: DatosCurso
  /** Al abrir: las fechas del calendario de ese curso escolar, solo para consultarlas. */
  periodos?: PeriodoTrimestre[]
  calendarioFijado?: boolean
  cursoAnterior: string | null
  problemas: ProblemaCurso[]
  ocupado: boolean
  onGuardar: (datos: DatosCurso) => void
  onCancelar: () => void
}

const CURSO_COMPLETO = /^\d{4}\/\d{4}$/

export function FormularioCurso({ alumnoId, modo, inicial, periodos: iniciales, calendarioFijado: fijadoInicial, cursoAnterior, problemas, ocupado, onGuardar, onCancelar }: Props) {
  const [datos, setDatos] = useState<DatosCurso>(inicial)
  const [calendario, setCalendario] = useState({ periodos: iniciales ?? [], fijado: fijadoInicial ?? false })

  const problemaDe = (campo: CampoCurso) => problemas.find((p) => p.campo === campo)?.mensaje

  // Al abrir, cambiar el curso muestra las fechas del calendario de ese otro curso escolar
  async function cambiarCurso(curso: string) {
    setDatos((actual) => ({ ...actual, curso }))
    if (modo !== 'abrir' || !CURSO_COMPLETO.test(curso)) return
    const propuesta = await window.ariadne.cursos.proponer(alumnoId, curso)
    if (propuesta.tipo === 'propuesta' && propuesta.curso === curso) {
      setCalendario({ periodos: propuesta.periodos, fijado: propuesta.calendarioFijado })
    }
  }

  function enviar(evento: FormEvent) {
    evento.preventDefault()
    onGuardar(datos)
  }

  const problemaCurso = problemaDe('curso')

  return (
    <form className="formulario formulario-curso" onSubmit={enviar} noValidate>
      <div className="fila-campos">
        <div className={problemaCurso ? 'campo con-problema' : 'campo'}>
          <label htmlFor="curso">Curso</label>
          <input
            id="curso"
            value={datos.curso}
            placeholder="2026/2027"
            readOnly={modo === 'corregir'}
            onChange={(e) => cambiarCurso(e.target.value)}
          />
          {problemaCurso && <p className="problema">{problemaCurso}</p>}
        </div>
        <div className="campo">
          <label htmlFor="nivelEducativo">Nivel educativo (opcional)</label>
          <input
            id="nivelEducativo"
            value={datos.nivelEducativo ?? ''}
            placeholder="Por ejemplo, 3.º de Primaria"
            onChange={(e) => setDatos((actual) => ({ ...actual, nivelEducativo: e.target.value }))}
          />
        </div>
      </div>

      {modo === 'abrir' && cursoAnterior && (
        <p className="apunte">Quedará enlazado con su curso anterior, {cursoAnterior}.</p>
      )}

      {modo === 'abrir' && calendario.periodos.length > 0 && (
        <div className="fechas-calendario">
          <p className="apunte">
            {calendario.fijado
              ? `Las fechas son las del calendario de ${datos.curso}, comunes a todos tus alumnos:`
              : `Aún no has fijado el calendario de ${datos.curso}. Se usarán estas fechas, que puedes cambiar en Calendario:`}
          </p>
          <ul className="lista-trimestres">
            {calendario.periodos.map((p) => (
              <li key={p.numero}>
                <span className="nombre-trimestre">{NOMBRE_TRIMESTRE[p.numero as NumeroTrimestre]}</span>
                <span>
                  del {fechaCorta(p.fechaInicio)} al {fechaCorta(p.fechaFin)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="acciones">
        <button type="submit" className="principal" disabled={ocupado}>
          {modo === 'abrir' ? `Abrir el curso ${datos.curso}` : 'Guardar cambios'}
        </button>
        <button type="button" onClick={onCancelar} disabled={ocupado}>
          Cancelar
        </button>
      </div>
    </form>
  )
}
