import type { CampoCurso, NumeroTrimestre, PeriodoTrimestre, ProblemaCurso } from '../../compartido/ipc'
import { NOMBRE_TRIMESTRE } from './FormularioCurso'

interface Props {
  periodos: PeriodoTrimestre[]
  problemas: ProblemaCurso[]
  /** Trimestres cuyas fechas ya no cambian: están cerrados para algún alumno. */
  bloqueados: NumeroTrimestre[]
  onCambiar: (periodos: PeriodoTrimestre[]) => void
}

/** Las fechas de inicio y fin de los tres trimestres de un curso escolar. */
export function FechasTrimestres({ periodos, problemas, bloqueados, onCambiar }: Props) {
  const problemaDe = (campo: CampoCurso) => problemas.find((p) => p.campo === campo)?.mensaje

  function cambiar(numero: NumeroTrimestre, extremo: 'fechaInicio' | 'fechaFin', valor: string) {
    onCambiar(periodos.map((p): PeriodoTrimestre => (p.numero === numero ? { ...p, [extremo]: valor } : p)))
  }

  return (
    <fieldset className="trimestres">
      <legend>Trimestres</legend>
      {periodos.map((periodo) => {
        const problema = problemaDe(`trimestre${periodo.numero}`)
        const bloqueado = bloqueados.includes(periodo.numero)
        return (
          <div key={periodo.numero} className={problema ? 'fila-trimestre con-problema' : 'fila-trimestre'}>
            <span className="nombre-trimestre">{NOMBRE_TRIMESTRE[periodo.numero]}</span>
            <label>
              del{' '}
              <input
                type="date"
                aria-label={`Inicio del ${NOMBRE_TRIMESTRE[periodo.numero]}`}
                value={periodo.fechaInicio}
                disabled={bloqueado}
                onChange={(e) => cambiar(periodo.numero, 'fechaInicio', e.target.value)}
              />
            </label>
            <label>
              al{' '}
              <input
                type="date"
                aria-label={`Fin del ${NOMBRE_TRIMESTRE[periodo.numero]}`}
                value={periodo.fechaFin}
                disabled={bloqueado}
                onChange={(e) => cambiar(periodo.numero, 'fechaFin', e.target.value)}
              />
            </label>
            {bloqueado && <span className="etiqueta etiqueta-apagada">cerrado</span>}
            {problema && <p className="problema">{problema}</p>}
          </div>
        )
      })}
    </fieldset>
  )
}
