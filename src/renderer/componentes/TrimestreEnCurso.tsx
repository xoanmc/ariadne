import type { VistaCurso, VistaPrograma } from '../../compartido/ipc'
import { fechaCorta } from '../fechas'
import { NOMBRE_TRIMESTRE } from './FormularioCurso'

interface Props {
  curso: VistaCurso
  programa: VistaPrograma | null
}

/** Lo que tiene entre manos: los objetivos del trimestre en curso, con su valoración actual. */
export function TrimestreEnCurso({ curso, programa }: Props) {
  const trimestre = curso.trimestres.find((t) => t.id === curso.trimestreEnCursoId)
  if (!trimestre) return null
  const objetivos = programa?.asignaciones.filter((a) => a.trimestreId === trimestre.id) ?? []

  return (
    <section className="en-curso">
      <h2>
        Ahora: {NOMBRE_TRIMESTRE[trimestre.numero]}{' '}
        <span className="apunte">
          del {fechaCorta(trimestre.fechaInicio)} al {fechaCorta(trimestre.fechaFin)}
        </span>
      </h2>
      {objetivos.length === 0 ? (
        <p className="apunte">
          {programa ? 'No hay objetivos en este trimestre.' : 'Todavía no hay programa de intervención: créalo más abajo.'}
        </p>
      ) : (
        <ul className="lista-objetivos">
          {objetivos.map((a) => (
            <li key={a.asignacionId}>
              <div className="fila-objetivo">
                <span className="texto-largo">{a.enunciado}</span>
                <span className="detalle-objetivo">
                  {a.arrastrado && <span className="etiqueta etiqueta-arrastrado">arrastrado</span>}
                  <span className={`valoracion valoracion-${a.valoracion}`}>{a.etiquetaValoracion}</span>
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
