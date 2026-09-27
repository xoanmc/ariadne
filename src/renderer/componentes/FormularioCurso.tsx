import { useState, type FormEvent } from 'react'
import type { CampoCurso, DatosCurso, NumeroTrimestre, PeriodoTrimestre, ProblemaCurso } from '../../compartido/ipc'

export const NOMBRE_TRIMESTRE: Record<NumeroTrimestre, string> = {
  1: '1.er trimestre',
  2: '2.º trimestre',
  3: '3.er trimestre'
}

interface Props {
  alumnoId: number
  modo: 'abrir' | 'corregir'
  inicial: DatosCurso
  cursoAnterior: string | null
  problemas: ProblemaCurso[]
  ocupado: boolean
  onGuardar: (datos: DatosCurso) => void
  onCancelar: () => void
}

const CURSO_COMPLETO = /^\d{4}\/\d{4}$/

export function FormularioCurso({ alumnoId, modo, inicial, cursoAnterior, problemas, ocupado, onGuardar, onCancelar }: Props) {
  const [datos, setDatos] = useState<DatosCurso>(inicial)

  const problemaDe = (campo: CampoCurso) => problemas.find((p) => p.campo === campo)?.mensaje

  // Al abrir, cambiar el curso rehace las fechas propuestas: todavía no las ha tocado nadie que importe.
  async function cambiarCurso(curso: string) {
    setDatos((actual) => ({ ...actual, curso }))
    if (modo !== 'abrir' || !CURSO_COMPLETO.test(curso)) return
    const propuesta = await window.ariadne.cursos.proponer(alumnoId, curso)
    if (propuesta.tipo === 'propuesta' && propuesta.curso === curso) {
      setDatos((actual) => ({ ...actual, periodos: propuesta.periodos }))
    }
  }

  function cambiarFecha(numero: NumeroTrimestre, extremo: 'fechaInicio' | 'fechaFin', valor: string) {
    setDatos((actual) => ({
      ...actual,
      periodos: actual.periodos.map((p): PeriodoTrimestre => (p.numero === numero ? { ...p, [extremo]: valor } : p))
    }))
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

      <fieldset className="trimestres">
        <legend>Trimestres</legend>
        <p className="apunte">
          Son fechas orientativas: corrígelas con el calendario de tu centro. Entre un trimestre y otro puede haber
          vacaciones.
        </p>
        {datos.periodos.map((periodo) => {
          const problema = problemaDe(`trimestre${periodo.numero}`)
          return (
            <div key={periodo.numero} className={problema ? 'fila-trimestre con-problema' : 'fila-trimestre'}>
              <span className="nombre-trimestre">{NOMBRE_TRIMESTRE[periodo.numero]}</span>
              <label>
                del{' '}
                <input
                  type="date"
                  aria-label={`Inicio del ${NOMBRE_TRIMESTRE[periodo.numero]}`}
                  value={periodo.fechaInicio}
                  onChange={(e) => cambiarFecha(periodo.numero, 'fechaInicio', e.target.value)}
                />
              </label>
              <label>
                al{' '}
                <input
                  type="date"
                  aria-label={`Fin del ${NOMBRE_TRIMESTRE[periodo.numero]}`}
                  value={periodo.fechaFin}
                  onChange={(e) => cambiarFecha(periodo.numero, 'fechaFin', e.target.value)}
                />
              </label>
              {problema && <p className="problema">{problema}</p>}
            </div>
          )
        })}
      </fieldset>

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
