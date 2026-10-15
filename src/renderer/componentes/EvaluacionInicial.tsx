import { useEffect, useState, type FormEvent } from 'react'
import type { CampoEvaluacion, DatosEvaluacion, ProblemaEvaluacion, VistaEvaluacion } from '../../compartido/ipc'
import { fechaCorta, hoy } from '../fechas'

interface Props {
  cursoId: number
  editable: boolean
  onResumen?: (resumen: string) => void
}

export function EvaluacionInicial({ cursoId, editable, onResumen }: Props) {
  const [evaluacion, setEvaluacion] = useState<VistaEvaluacion | null | undefined>(undefined)
  const [editando, setEditando] = useState<DatosEvaluacion | null>(null)
  const [sugerencias, setSugerencias] = useState<string[]>([])
  const [problemas, setProblemas] = useState<ProblemaEvaluacion[]>([])
  const [rechazo, setRechazo] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const api = window.ariadne.evaluaciones

  useEffect(() => {
    if (evaluacion !== undefined) onResumen?.(evaluacion ? `hecha el ${fechaCorta(evaluacion.fecha)}` : 'sin registrar')
  }, [evaluacion])

  useEffect(() => {
    api.deCurso(cursoId).then(setEvaluacion)
  }, [cursoId])

  async function empezar() {
    setSugerencias(await api.sugerenciasDeInstrumento())
    setProblemas([])
    setRechazo(null)
    setEditando(
      evaluacion
        ? { fecha: evaluacion.fecha, instrumento: evaluacion.instrumento, contenido: evaluacion.contenido }
        : { fecha: hoy(), instrumento: null, contenido: '' }
    )
  }

  async function guardar(evento: FormEvent) {
    evento.preventDefault()
    if (!editando) return
    setOcupado(true)
    const resultado = await api.guardar(cursoId, editando)
    setOcupado(false)

    if (resultado.tipo === 'guardada') {
      setEvaluacion(resultado.evaluacion)
      setEditando(null)
    } else if (resultado.tipo === 'invalida') {
      setProblemas(resultado.problemas)
    } else {
      setRechazo(resultado.mensaje)
    }
  }

  const problemaDe = (campo: CampoEvaluacion) => problemas.find((p) => p.campo === campo)?.mensaje
  const clase = (campo: CampoEvaluacion) => (problemaDe(campo) ? 'campo con-problema' : 'campo')

  if (evaluacion === undefined) return null

  return (
    <div className="evaluacion">

      {editando ? (
        <form className="formulario" onSubmit={guardar} noValidate>
          <div className="fila-campos">
            <div className={clase('fecha')}>
              <label htmlFor="fechaEvaluacion">Fecha</label>
              <input
                id="fechaEvaluacion"
                type="date"
                max={hoy()}
                value={editando.fecha}
                onChange={(e) => setEditando({ ...editando, fecha: e.target.value })}
              />
              {problemaDe('fecha') && <p className="problema">{problemaDe('fecha')}</p>}
            </div>
            <div className="campo">
              <label htmlFor="instrumento">Instrumento (opcional)</label>
              <input
                id="instrumento"
                list="instrumentos-sugeridos"
                placeholder="Si usaste alguno"
                value={editando.instrumento ?? ''}
                onChange={(e) => setEditando({ ...editando, instrumento: e.target.value })}
              />
              <datalist id="instrumentos-sugeridos">
                {sugerencias.map((s) => (
                  <option key={s} value={s} />
                ))}
              </datalist>
            </div>
          </div>
          <div className={clase('contenido')}>
            <label htmlFor="contenidoEvaluacion">Contenido</label>
            <textarea
              id="contenidoEvaluacion"
              rows={6}
              value={editando.contenido}
              onChange={(e) => setEditando({ ...editando, contenido: e.target.value })}
            />
            {problemaDe('contenido') && <p className="problema">{problemaDe('contenido')}</p>}
          </div>
          <div className="acciones">
            <button type="submit" className="principal" disabled={ocupado}>
              Guardar evaluación
            </button>
            <button type="button" onClick={() => setEditando(null)} disabled={ocupado}>
              Cancelar
            </button>
          </div>
          {rechazo && <p className="aviso">{rechazo}</p>}
        </form>
      ) : evaluacion ? (
        <>
          <p className="apunte">
            {fechaCorta(evaluacion.fecha)}
            {evaluacion.instrumento && ` · ${evaluacion.instrumento}`}
          </p>
          <p className="texto-largo">{evaluacion.contenido}</p>
          {editable && (
            <div className="acciones">
              <button onClick={empezar}>Editar evaluación</button>
            </div>
          )}
        </>
      ) : editable ? (
        <>
          <p className="apunte">Todavía no tiene la evaluación inicial de este curso.</p>
          <div className="acciones">
            <button onClick={empezar}>Registrar evaluación inicial</button>
          </div>
        </>
      ) : (
        <p className="apunte">En este curso no se registró evaluación inicial.</p>
      )}
    </div>
  )
}
