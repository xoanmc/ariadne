import { useEffect, useState, type FormEvent } from 'react'
import type { ResultadoPrograma, VistaPrograma, VistaTrimestre } from '../../compartido/ipc'
import { fechaCorta, hoy } from '../fechas'
import { NOMBRE_TRIMESTRE } from './FormularioCurso'

interface Props {
  cursoId: number
  trimestres: VistaTrimestre[]
  editable: boolean
}

type Problemas = { campo: string; mensaje: string }[]

/** El trimestre en curso por la fecha de hoy o, si hoy cae fuera (vacaciones, verano), el primero abierto. */
function trimestrePropuesto(abiertos: VistaTrimestre[]): number | null {
  const hoyMismo = hoy()
  return (abiertos.find((t) => t.fechaInicio <= hoyMismo && hoyMismo <= t.fechaFin) ?? abiertos[0])?.id ?? null
}

export function Programa({ cursoId, trimestres, editable }: Props) {
  const [programa, setPrograma] = useState<VistaPrograma | null | undefined>(undefined)
  const [editandoContenido, setEditandoContenido] = useState<string | null>(null)
  const [nuevo, setNuevo] = useState<{ enunciado: string; trimestreId: number | null } | null>(null)
  const [problemas, setProblemas] = useState<Problemas>([])
  const [rechazo, setRechazo] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const api = window.ariadne.programas
  const abiertos = trimestres.filter((t) => t.estado === 'abierto')

  useEffect(() => {
    api.deCurso(cursoId).then(setPrograma)
  }, [cursoId])

  async function aplicar(peticion: Promise<ResultadoPrograma>, alTerminar: () => void) {
    setOcupado(true)
    const resultado = await peticion
    setOcupado(false)
    if (resultado.tipo === 'invalido') return setProblemas(resultado.problemas)
    if (resultado.tipo === 'rechazado') return setRechazo(resultado.mensaje)
    setPrograma(resultado.programa)
    setProblemas([])
    setRechazo(null)
    alTerminar()
  }

  function guardarContenido(evento: FormEvent) {
    evento.preventDefault()
    if (editandoContenido === null) return
    const peticion = programa
      ? api.editarContenido(programa.id, editandoContenido)
      : api.crear(cursoId, editandoContenido)
    aplicar(peticion, () => setEditandoContenido(null))
  }

  function guardarObjetivo(evento: FormEvent) {
    evento.preventDefault()
    if (!programa || !nuevo) return
    aplicar(api.anadirObjetivo(programa.id, { enunciado: nuevo.enunciado, trimestreId: nuevo.trimestreId ?? 0 }), () =>
      setNuevo(null)
    )
  }

  const problemaDe = (campo: string) => problemas.find((p) => p.campo === campo)?.mensaje

  if (programa === undefined) return null

  const formularioContenido = editandoContenido !== null && (
    <form className="formulario" onSubmit={guardarContenido} noValidate>
      <div className="campo">
        <label htmlFor="contenidoPrograma">Contenido general (opcional)</label>
        <textarea
          id="contenidoPrograma"
          rows={5}
          value={editandoContenido}
          onChange={(e) => setEditandoContenido(e.target.value)}
        />
      </div>
      <div className="acciones">
        <button type="submit" className="principal" disabled={ocupado}>
          {programa ? 'Guardar contenido' : 'Crear programa'}
        </button>
        <button type="button" onClick={() => setEditandoContenido(null)} disabled={ocupado}>
          Cancelar
        </button>
      </div>
      {rechazo && <p className="aviso">{rechazo}</p>}
    </form>
  )

  if (!programa) {
    return (
      <div className="programa">
        <h2>Programa de intervención</h2>
        {formularioContenido ||
          (editable ? (
            <>
              <p className="apunte">Este curso todavía no tiene programa de intervención.</p>
              <div className="acciones">
                <button className="principal" onClick={() => setEditandoContenido('')}>
                  Crear programa
                </button>
              </div>
            </>
          ) : (
            <p className="apunte">En este curso no se registró programa de intervención.</p>
          ))}
      </div>
    )
  }

  return (
    <div className="programa">
      <h2>Programa de intervención</h2>
      <p className="apunte">
        Creado el {fechaCorta(programa.fechaCreacion)}
        {programa.fechaRevision && ` · revisado por última vez el ${fechaCorta(programa.fechaRevision)}`}
      </p>

      {formularioContenido || (
        <>
          {programa.contenido ? (
            <p className="texto-largo">{programa.contenido}</p>
          ) : (
            <p className="apunte">Sin contenido general.</p>
          )}
          {editable && (
            <div className="acciones">
              <button onClick={() => setEditandoContenido(programa.contenido ?? '')}>Editar contenido general</button>
            </div>
          )}
        </>
      )}

      <h3 className="titulo-objetivos">Objetivos</h3>
      {programa.asignaciones.length === 0 && <p className="apunte">Todavía no tiene objetivos.</p>}
      {trimestres.map((t) => {
        const delTrimestre = programa.asignaciones.filter((a) => a.trimestreId === t.id)
        if (delTrimestre.length === 0) return null
        return (
          <div key={t.id} className="grupo-objetivos">
            <p className="subtitulo">{NOMBRE_TRIMESTRE[t.numero]}</p>
            <ul className="lista-objetivos">
              {delTrimestre.map((a) => (
                <li key={a.asignacionId}>
                  <span className="texto-largo">{a.enunciado}</span>
                  <span className="detalle-objetivo">
                    {a.arrastrado && <span className="etiqueta etiqueta-apagada">arrastrado</span>}
                    <span className={`valoracion valoracion-${a.valoracion}`}>{a.etiquetaValoracion}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )
      })}

      {editable &&
        (nuevo ? (
          <form className="formulario" onSubmit={guardarObjetivo} noValidate>
            <div className={problemaDe('enunciado') ? 'campo con-problema' : 'campo'}>
              <label htmlFor="enunciado">Enunciado del objetivo</label>
              <textarea
                id="enunciado"
                rows={2}
                value={nuevo.enunciado}
                onChange={(e) => setNuevo({ ...nuevo, enunciado: e.target.value })}
                autoFocus
              />
              {problemaDe('enunciado') && <p className="problema">{problemaDe('enunciado')}</p>}
            </div>
            <div className={problemaDe('trimestre') ? 'campo con-problema' : 'campo'}>
              <label htmlFor="trimestreObjetivo">Trimestre</label>
              <select
                id="trimestreObjetivo"
                value={nuevo.trimestreId ?? ''}
                onChange={(e) => setNuevo({ ...nuevo, trimestreId: Number(e.target.value) })}
              >
                {abiertos.map((t) => (
                  <option key={t.id} value={t.id}>
                    {NOMBRE_TRIMESTRE[t.numero]}
                  </option>
                ))}
              </select>
              {problemaDe('trimestre') && <p className="problema">{problemaDe('trimestre')}</p>}
            </div>
            <div className="acciones">
              <button type="submit" className="principal" disabled={ocupado}>
                Añadir objetivo
              </button>
              <button type="button" onClick={() => setNuevo(null)} disabled={ocupado}>
                Cancelar
              </button>
            </div>
            {rechazo && <p className="aviso">{rechazo}</p>}
          </form>
        ) : (
          abiertos.length > 0 && (
            <div className="acciones">
              <button
                onClick={() => {
                  setProblemas([])
                  setRechazo(null)
                  setNuevo({ enunciado: '', trimestreId: trimestrePropuesto(abiertos) })
                }}
              >
                Añadir objetivo
              </button>
            </div>
          )
        ))}
    </div>
  )
}
