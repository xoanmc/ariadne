import { useEffect, useState, type FormEvent } from 'react'
import type { CampoActa, DatosActa, ProblemaActa, VistaActa } from '../../compartido/ipc'
import { fechaCorta, hoy } from '../fechas'

interface Props {
  cursoId: number
  editable: boolean
  onResumen?: (resumen: string) => void
}

/** Qué se está editando: un acta nueva (null) o una existente (su id). */
type Edicion = { actaId: number | null; datos: DatosActa }

export function Actas({ cursoId, editable, onResumen }: Props) {
  const [actas, setActas] = useState<VistaActa[] | null>(null)
  const [edicion, setEdicion] = useState<Edicion | null>(null)
  const [problemas, setProblemas] = useState<ProblemaActa[]>([])
  const [rechazo, setRechazo] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)

  useEffect(() => {
    if (actas) onResumen?.(actas.length === 0 ? 'ninguna' : actas.length === 1 ? '1 acta' : `${actas.length} actas`)
  }, [actas])
  const api = window.ariadne.actas

  useEffect(() => {
    api.deCurso(cursoId).then(setActas)
  }, [cursoId])

  function empezar(actaId: number | null, datos: DatosActa) {
    setProblemas([])
    setRechazo(null)
    setEdicion({ actaId, datos })
  }

  async function guardar(evento: FormEvent) {
    evento.preventDefault()
    if (!edicion) return
    setOcupado(true)
    const resultado =
      edicion.actaId === null ? await api.registrar(cursoId, edicion.datos) : await api.corregir(edicion.actaId, edicion.datos)
    setOcupado(false)

    if (resultado.tipo === 'invalida') return setProblemas(resultado.problemas)
    if (resultado.tipo === 'rechazada') return setRechazo(resultado.mensaje)
    setEdicion(null)
    setActas(await api.deCurso(cursoId))
  }

  if (!actas) return null

  const problemaDe = (campo: CampoActa) => problemas.find((p) => p.campo === campo)?.mensaje
  const clase = (campo: CampoActa) => (problemaDe(campo) ? 'campo con-problema' : 'campo')
  const cambiar = (campo: CampoActa, valor: string) =>
    setEdicion((actual) => (actual ? { ...actual, datos: { ...actual.datos, [campo]: valor } } : actual))

  const formulario = edicion && (
    <form className="formulario" onSubmit={guardar} noValidate>
      <div className="fila-campos">
        <div className={clase('fecha')}>
          <label htmlFor="fechaActa">Fecha de la reunión</label>
          <input
            id="fechaActa"
            type="date"
            max={hoy()}
            value={edicion.datos.fecha}
            onChange={(e) => cambiar('fecha', e.target.value)}
          />
          {problemaDe('fecha') && <p className="problema">{problemaDe('fecha')}</p>}
        </div>
        <div className="campo">
          <label htmlFor="asistentes">Asistentes (opcional)</label>
          <input
            id="asistentes"
            placeholder="Por ejemplo, madre, tutora y orientadora"
            value={edicion.datos.asistentes ?? ''}
            onChange={(e) => cambiar('asistentes', e.target.value)}
          />
        </div>
      </div>
      <div className={clase('contenido')}>
        <label htmlFor="contenidoActa">Contenido</label>
        <textarea
          id="contenidoActa"
          rows={5}
          value={edicion.datos.contenido ?? ''}
          onChange={(e) => cambiar('contenido', e.target.value)}
        />
        {problemaDe('contenido') && <p className="problema">{problemaDe('contenido')}</p>}
      </div>
      <div className="campo">
        <label htmlFor="acuerdos">Acuerdos</label>
        <textarea id="acuerdos" rows={3} value={edicion.datos.acuerdos ?? ''} onChange={(e) => cambiar('acuerdos', e.target.value)} />
      </div>
      <div className="acciones">
        <button type="submit" className="principal" disabled={ocupado}>
          {edicion.actaId === null ? 'Guardar acta' : 'Guardar cambios'}
        </button>
        <button type="button" onClick={() => setEdicion(null)} disabled={ocupado}>
          Cancelar
        </button>
      </div>
      {rechazo && <p className="aviso">{rechazo}</p>}
    </form>
  )

  return (
    <div className="actas">

      {edicion?.actaId === null ? (
        formulario
      ) : (
        editable && (
          <div className="acciones">
            <button onClick={() => empezar(null, { fecha: hoy(), asistentes: null, contenido: null, acuerdos: null })}>
              Registrar un acta
            </button>
          </div>
        )
      )}

      {actas.length === 0 && edicion?.actaId !== null && (
        <p className="apunte">{editable ? 'Todavía no hay actas en este curso.' : 'En este curso no se registró ninguna acta.'}</p>
      )}

      <ul className="lista-actas">
        {actas.map((acta) =>
          edicion?.actaId === acta.id ? (
            <li key={acta.id}>{formulario}</li>
          ) : (
            <li key={acta.id} className="acta">
              <p className="cabecera-acta">
                <strong>{fechaCorta(acta.fecha)}</strong>
                {acta.asistentes && <span className="apunte"> · {acta.asistentes}</span>}
              </p>
              {acta.contenido && <p className="texto-largo">{acta.contenido}</p>}
              {acta.acuerdos && (
                <>
                  <p className="subtitulo">Acuerdos</p>
                  <p className="texto-largo">{acta.acuerdos}</p>
                </>
              )}
              {editable && !edicion && (
                <button
                  onClick={() =>
                    empezar(acta.id, {
                      fecha: acta.fecha,
                      asistentes: acta.asistentes,
                      contenido: acta.contenido,
                      acuerdos: acta.acuerdos
                    })
                  }
                >
                  Corregir
                </button>
              )}
            </li>
          )
        )}
      </ul>
    </div>
  )
}
