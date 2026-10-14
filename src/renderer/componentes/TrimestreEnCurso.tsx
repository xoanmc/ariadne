import type { VistaCurso, VistaPrograma } from '../../compartido/ipc'
import { fechaCorta } from '../fechas'
import { NOMBRE_TRIMESTRE } from './FormularioCurso'

interface Props {
  curso: VistaCurso
  programa: VistaPrograma | null
  onCerrar: (trimestreId: number) => void
}

/** Lo que tiene entre manos: los objetivos del trimestre en curso, con su valoración actual. */
export function TrimestreEnCurso({ curso, programa, onCerrar }: Props) {
  const trimestre = curso.trimestres.find((t) => t.id === curso.trimestreEnCursoId)
  if (!trimestre) return null
  const objetivos = programa?.asignaciones.filter((a) => a.trimestreId === trimestre.id) ?? []
  // Se cierran en orden: el que toca puede no ser el de la fecha de hoy, si el anterior sigue abierto
  const aCerrar = curso.trimestres.find((t) => t.id === curso.trimestreACerrarId)

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
                  {a.estancado !== null && <span className="etiqueta etiqueta-estancado">estancado · {a.estancado} trimestres</span>}
                  <span className={`valoracion valoracion-${a.valoracion}`}>{a.etiquetaValoracion}</span>
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
      {aCerrar && (
        <div className="acciones">
          <button onClick={() => onCerrar(aCerrar.id)}>Cerrar el {NOMBRE_TRIMESTRE[aCerrar.numero]}</button>
        </div>
      )}
    </section>
  )
}
