import { useState, type FormEvent } from 'react'
import type { PendientesAnteriores, ResultadoPrograma, VistaAsignacion, VistaPrograma, VistaTrimestre } from '../../compartido/ipc'
import { fechaCorta, hoy } from '../fechas'
import { NOMBRE_TRIMESTRE } from './FormularioCurso'

interface Props {
  cursoId: number
  trimestres: VistaTrimestre[]
  editable: boolean
  /** Lo carga la pantalla del curso, que lo comparte con el recuadro del trimestre en curso. */
  programa: VistaPrograma | null | undefined
  onPrograma: (programa: VistaPrograma) => void
}

type Problemas = { campo: string; mensaje: string }[]

/** Lo que se está haciendo con un objetivo concreto de la lista. */
type Accion =
  | { tipo: 'editar'; asignacionId: number; objetivoId: number; texto: string }
  | { tipo: 'mover'; asignacionId: number; trimestreId: number }
  | { tipo: 'quitar'; asignacionId: number; objetivoId: number }

/** El trimestre en curso por la fecha de hoy o, si hoy cae fuera (vacaciones, verano), el primero abierto. */
function trimestrePropuesto(abiertos: VistaTrimestre[]): number | null {
  const hoyMismo = hoy()
  return (abiertos.find((t) => t.fechaInicio <= hoyMismo && hoyMismo <= t.fechaFin) ?? abiertos[0])?.id ?? null
}

export function Programa({ cursoId, trimestres, editable, programa, onPrograma }: Props) {
  const [editandoContenido, setEditandoContenido] = useState<string | null>(null)
  const [nuevo, setNuevo] = useState<{ enunciado: string; trimestreId: number | null } | null>(null)
  const [problemas, setProblemas] = useState<Problemas>([])
  const [rechazo, setRechazo] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const [pendientes, setPendientes] = useState<PendientesAnteriores | null>(null)
  const [accion, setAccion] = useState<Accion | null>(null)
  const [elegidos, setElegidos] = useState<Set<number>>(new Set())
  const api = window.ariadne.programas
  const abiertos = trimestres.filter((t) => t.estado === 'abierto')

  async function aplicar(peticion: Promise<ResultadoPrograma>, alTerminar: () => void) {
    setOcupado(true)
    const resultado = await peticion
    setOcupado(false)
    if (resultado.tipo === 'invalido') return setProblemas(resultado.problemas)
    if (resultado.tipo === 'rechazado') return setRechazo(resultado.mensaje)
    onPrograma(resultado.programa)
    setProblemas([])
    setRechazo(null)
    alTerminar()
  }

  function guardarContenido(evento: FormEvent) {
    evento.preventDefault()
    if (editandoContenido === null) return
    const peticion = programa
      ? api.editarContenido(programa.id, editandoContenido)
      : api.crear(cursoId, editandoContenido, [...elegidos])
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

  function empezarAccion(nueva: Accion) {
    setProblemas([])
    setRechazo(null)
    setNuevo(null)
    setAccion(nueva)
  }

  /** Los botones de un objetivo, o el formulario de la acción en curso sobre él. */
  function accionesDe(a: VistaAsignacion) {
    const enCurso = accion?.asignacionId === a.asignacionId ? accion : null
    const destinos = abiertos.filter((t) => t.id !== a.trimestreId)
    const error = enCurso && (problemas[0]?.mensaje ?? rechazo)

    if (enCurso?.tipo === 'editar') {
      return (
        <div className="acciones-objetivo">
          <button
            className="principal"
            disabled={ocupado}
            onClick={() => aplicar(api.editarObjetivo(a.objetivoId, enCurso.texto), () => setAccion(null))}
          >
            Guardar
          </button>
          <button onClick={() => setAccion(null)} disabled={ocupado}>Cancelar</button>
          {error && <p className="problema">{error}</p>}
        </div>
      )
    }
    if (enCurso?.tipo === 'mover') {
      return (
        <div className="acciones-objetivo">
          <label>
            Llevar al{' '}
            <select
              aria-label="Trimestre de destino"
              value={enCurso.trimestreId}
              onChange={(e) => setAccion({ ...enCurso, trimestreId: Number(e.target.value) })}
            >
              {destinos.map((t) => (
                <option key={t.id} value={t.id}>{NOMBRE_TRIMESTRE[t.numero]}</option>
              ))}
            </select>
          </label>
          <button
            className="principal"
            disabled={ocupado}
            onClick={() => aplicar(api.moverObjetivo(a.asignacionId, enCurso.trimestreId), () => setAccion(null))}
          >
            Mover
          </button>
          <button onClick={() => setAccion(null)} disabled={ocupado}>Cancelar</button>
          {error && <p className="problema">{error}</p>}
        </div>
      )
    }
    if (enCurso?.tipo === 'quitar') {
      return (
        <div className="acciones-objetivo">
          <span>¿Quitar este objetivo del programa?</span>
          <button
            className="principal"
            disabled={ocupado}
            onClick={() => aplicar(api.quitarObjetivo(a.objetivoId), () => setAccion(null))}
          >
            Quitar
          </button>
          <button onClick={() => setAccion(null)} disabled={ocupado}>Cancelar</button>
          {error && <p className="problema">{error}</p>}
        </div>
      )
    }
    if (accion) return null
    return (
      <div className="acciones-objetivo">
        <button className="enlace" onClick={() => empezarAccion({ tipo: 'editar', asignacionId: a.asignacionId, objetivoId: a.objetivoId, texto: a.enunciado })}>
          Editar
        </button>
        {a.puedeMoverse && destinos.length > 0 && (
          <button className="enlace" onClick={() => empezarAccion({ tipo: 'mover', asignacionId: a.asignacionId, trimestreId: destinos[0].id })}>
            Mover de trimestre
          </button>
        )}
        {a.puedeQuitarse && (
          <button className="enlace" onClick={() => empezarAccion({ tipo: 'quitar', asignacionId: a.asignacionId, objetivoId: a.objetivoId })}>
            Quitar
          </button>
        )}
      </div>
    )
  }

  if (programa === undefined) return null

  const formularioContenido = editandoContenido !== null && (
    <form className="formulario" onSubmit={guardarContenido} noValidate>
      {!programa && pendientes && (
        <fieldset className="pendientes">
          <legend>Objetivos pendientes del curso {pendientes.curso}</legend>
          <p className="apunte">
            Acabaron el curso sin conseguirse o sin abordarse. Los marcados pasan al 1.er trimestre de este curso, enlazados
            con su historia; luego puedes reformularlos sin tocar lo del año pasado.
          </p>
          {pendientes.objetivos.map((o) => (
            <label key={o.asignacionId} className="pendiente">
              <input
                type="checkbox"
                checked={elegidos.has(o.asignacionId)}
                onChange={(e) => {
                  const siguiente = new Set(elegidos)
                  if (e.target.checked) siguiente.add(o.asignacionId)
                  else siguiente.delete(o.asignacionId)
                  setElegidos(siguiente)
                }}
              />
              <span className="texto-largo">{o.enunciado}</span>
              <span className={`valoracion valoracion-${o.valoracion}`}>{o.etiquetaValoracion}</span>
            </label>
          ))}
        </fieldset>
      )}
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
        {formularioContenido ||
          (editable ? (
            <>
              <p className="apunte">Este curso todavía no tiene programa de intervención.</p>
              <div className="acciones">
                <button
                  className="principal"
                  onClick={async () => {
                    // Lo normal es continuar con lo pendiente: vienen todos marcados y ella desmarca
                    const anteriores = await api.pendientesDelCursoAnterior(cursoId)
                    setPendientes(anteriores)
                    setElegidos(new Set(anteriores?.objetivos.map((o) => o.asignacionId) ?? []))
                    setEditandoContenido('')
                  }}
                >
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
                <li key={a.asignacionId} className="objetivo">
                  <div className="fila-objetivo">
                    {accion?.tipo === 'editar' && accion.asignacionId === a.asignacionId ? (
                      <textarea
                        className="editar-enunciado"
                        aria-label="Enunciado del objetivo"
                        rows={2}
                        value={accion.texto}
                        onChange={(e) => setAccion({ ...accion, texto: e.target.value })}
                        autoFocus
                      />
                    ) : (
                      <span className="texto-largo">{a.enunciado}</span>
                    )}
                    <span className="detalle-objetivo">
                      {a.arrastrado && <span className="etiqueta etiqueta-arrastrado">arrastrado</span>}
                      {a.estancado !== null && <span className="etiqueta etiqueta-estancado">estancado · {a.estancado} trimestres</span>}
                      <span className={`valoracion valoracion-${a.valoracion}`}>{a.etiquetaValoracion}</span>
                    </span>
                  </div>
                  {editable && accionesDe(a)}
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
                  setAccion(null)
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
