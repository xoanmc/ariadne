import { useEffect, useState, type FormEvent } from 'react'
import type { AlumnoEnLista, CategoriaCatalogo, DatosSesion, ListaDeOpciones, ObjetivosParaSesion } from '../../compartido/ipc'
import { hoy } from '../fechas'

interface Props {
  alumnoId: number | null
  /** Si viene, se corrige esa sesión en lugar de registrar una nueva. */
  sesionId?: number
  onRegistrada: (resumen: string) => void
  onCancelar: () => void
  onOpciones: () => void
}

type Problemas = { campo: string; mensaje: string }[]

const CAMPO: Record<CategoriaCatalogo, 'estadoAlumno' | 'respuestaActividades'> = {
  estado_alumno: 'estadoAlumno',
  respuesta_actividades: 'respuestaActividades'
}

/**
 * La pantalla en la que se juega el criterio de los dos minutos: todo a la vista, nada que buscar en
 * menús, el trimestre deducido. Lo poco frecuente (incidencias, salud) va plegado.
 */
export function PantallaRegistro({ alumnoId, sesionId, onRegistrada, onCancelar, onOpciones }: Props) {
  const [alumnos, setAlumnos] = useState<AlumnoEnLista[] | null>(null)
  const [listas, setListas] = useState<ListaDeOpciones[] | null>(null)
  const [alumno, setAlumno] = useState<number | null>(alumnoId)
  const [datos, setDatos] = useState<DatosSesion>({
    fecha: hoy(),
    objetivos: [],
    estadoAlumno: [],
    respuestaActividades: [],
    observaciones: null,
    incidencias: null,
    saludMedicacion: null
  })
  const [problemas, setProblemas] = useState<Problemas>([])
  const [rechazo, setRechazo] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const [delTrimestre, setDelTrimestre] = useState<ObjetivosParaSesion | null>(null)

  useEffect(() => {
    Promise.all([window.ariadne.alumnos.listar(), window.ariadne.catalogo.listar()]).then(async ([todos, opciones]) => {
      if (sesionId !== undefined) {
        const sesion = await window.ariadne.sesiones.obtener(sesionId)
        if (sesion) {
          setAlumno(sesion.alumnoId)
          setDatos({
            fecha: sesion.fecha,
            objetivos: sesion.objetivos.map((o) => o.objetivoId),
            estadoAlumno: sesion.estadoAlumno,
            respuestaActividades: sesion.respuestaActividades,
            observaciones: sesion.observaciones,
            incidencias: sesion.incidencias,
            saludMedicacion: sesion.saludMedicacion
          })
        }
      }
      setAlumnos(todos.filter((a) => a.cursoActivo))
      setListas(opciones)
    })
  }, [sesionId])

  /** Un aviso se va en cuanto ella toca lo que lo provocó: no puede quedarse acusando algo ya corregido. */
  function cambiar(cambios: Partial<DatosSesion>) {
    setDatos((actual) => ({ ...actual, ...cambios }))
    const campo = 'fecha' in cambios ? 'fecha' : 'contenido'
    setProblemas((actuales) => actuales.filter((p) => p.campo !== campo))
  }

  // Los objetivos que se ofrecen son los del trimestre en el que cae la fecha: si cambia alumno o fecha, cambian
  useEffect(() => {
    if (alumno === null) return setDelTrimestre(null)
    window.ariadne.sesiones.objetivosPara(alumno, datos.fecha).then((encontrados) => {
      setDelTrimestre(encontrados)
      const validos = new Set(encontrados?.objetivos.map((o) => o.objetivoId) ?? [])
      setDatos((actual) => ({ ...actual, objetivos: actual.objetivos.filter((id) => validos.has(id)) }))
    })
  }, [alumno, datos.fecha])

  function alternarObjetivo(id: number) {
    setDatos((actual) => ({
      ...actual,
      objetivos: actual.objetivos.includes(id) ? actual.objetivos.filter((o) => o !== id) : [...actual.objetivos, id]
    }))
  }

  function alternar(campo: 'estadoAlumno' | 'respuestaActividades', opcion: string) {
    setProblemas((actuales) => actuales.filter((p) => p.campo !== 'contenido'))
    setDatos((actual) => {
      const marcadas = actual[campo]
      return { ...actual, [campo]: marcadas.includes(opcion) ? marcadas.filter((o) => o !== opcion) : [...marcadas, opcion] }
    })
  }

  async function registrar(evento: FormEvent) {
    evento.preventDefault()
    if (alumno === null) return setRechazo('Elige un alumno.')
    setOcupado(true)
    const resultado =
      sesionId !== undefined
        ? await window.ariadne.sesiones.corregir(sesionId, alumno, datos)
        : await window.ariadne.sesiones.registrar(alumno, datos)
    setOcupado(false)
    if (resultado.tipo === 'registrada') return onRegistrada(resultado.resumen)
    if (resultado.tipo === 'invalida') {
      setRechazo(null)
      return setProblemas(resultado.problemas)
    }
    setProblemas([])
    setRechazo(resultado.mensaje)
  }

  if (!alumnos || !listas) return null
  const problemaDe = (campo: string) => problemas.find((p) => p.campo === campo)?.mensaje
  const sinOpciones = listas.every((l) => l.opciones.every((o) => !o.activa))

  return (
    <main className="pantalla">
      <h1>{sesionId !== undefined ? 'Corregir sesión' : 'Registrar sesión'}</h1>

      <form className="formulario registro" onSubmit={registrar} noValidate>
        <div className="fila-campos">
          <div className="campo">
            <label htmlFor="alumnoSesion">Alumno</label>
            <select id="alumnoSesion" value={alumno ?? ''} onChange={(e) => setAlumno(Number(e.target.value) || null)}>
              <option value="">Elige un alumno</option>
              {alumnos.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.nombre} {a.apellidos}
                </option>
              ))}
            </select>
          </div>
          <div className={problemaDe('fecha') ? 'campo con-problema' : 'campo'}>
            <label htmlFor="fechaSesion">Fecha</label>
            <input
              id="fechaSesion"
              type="date"
              max={hoy()}
              value={datos.fecha}
              onChange={(e) => cambiar({ fecha: e.target.value })}
            />
            {problemaDe('fecha') && <p className="problema">{problemaDe('fecha')}</p>}
          </div>
        </div>

        {listas.map((lista) => {
          const campo = CAMPO[lista.categoria]
          // Al corregir, una opción ya marcada que ella desactivó o corrigió sigue apareciendo marcada: no se pierde
          const enLista = new Set(lista.opciones.filter((o) => o.activa).map((o) => o.texto))
          const activas = [
            ...lista.opciones.filter((o) => o.activa).map((o) => ({ id: `o${o.id}`, texto: o.texto })),
            ...datos[campo].filter((t) => !enLista.has(t)).map((t) => ({ id: `m${t}`, texto: t }))
          ]
          return (
            <fieldset key={lista.categoria} className="opciones-sesion">
              <legend>{lista.nombre}</legend>
              {activas.length === 0 ? (
                <p className="apunte">
                  Sin opciones todavía.{' '}
                  <button type="button" className="enlace" onClick={onOpciones}>
                    Añadir opciones
                  </button>
                </p>
              ) : (
                <div className="chips">
                  {activas.map((o) => {
                    const marcada = datos[campo].includes(o.texto)
                    return (
                      <button
                        key={o.id}
                        type="button"
                        className={marcada ? 'chip marcada' : 'chip'}
                        aria-pressed={marcada}
                        onClick={() => alternar(campo, o.texto)}
                      >
                        {o.texto}
                      </button>
                    )
                  })}
                </div>
              )}
            </fieldset>
          )
        })}

        {delTrimestre && delTrimestre.objetivos.length > 0 && (
          <fieldset className="objetivos-sesion">
            <legend>Objetivos trabajados (opcional) · {delTrimestre.trimestre}</legend>
            {delTrimestre.objetivos.map((o) => (
              <label key={o.objetivoId} className="pendiente">
                <input
                  type="checkbox"
                  checked={datos.objetivos.includes(o.objetivoId)}
                  onChange={() => alternarObjetivo(o.objetivoId)}
                />
                <span className="texto-largo">{o.enunciado}</span>
                {o.arrastrado && <span className="etiqueta etiqueta-arrastrado">arrastrado</span>}
              </label>
            ))}
          </fieldset>
        )}

        <div className={problemaDe('contenido') ? 'campo con-problema' : 'campo'}>
          <label htmlFor="observaciones">Observaciones</label>
          <textarea
            id="observaciones"
            rows={3}
            placeholder={sinOpciones ? 'Cómo fue la sesión' : 'Lo que quieras matizar'}
            value={datos.observaciones ?? ''}
            onChange={(e) => cambiar({ observaciones: e.target.value })}
          />
          {problemaDe('contenido') && <p className="problema">{problemaDe('contenido')}</p>}
        </div>

        <details className="plegado">
          <summary>Incidencias</summary>
          <textarea
            aria-label="Incidencias"
            rows={2}
            value={datos.incidencias ?? ''}
            onChange={(e) => cambiar({ incidencias: e.target.value })}
          />
        </details>
        <details className="plegado">
          <summary>Salud o medicación</summary>
          <textarea
            aria-label="Salud o medicación"
            rows={2}
            value={datos.saludMedicacion ?? ''}
            onChange={(e) => cambiar({ saludMedicacion: e.target.value })}
          />
        </details>

        <div className="acciones">
          <button type="submit" className="principal" disabled={ocupado}>
            {sesionId !== undefined ? 'Guardar cambios' : 'Registrar sesión'}
          </button>
          <button type="button" onClick={onCancelar} disabled={ocupado}>
            Cancelar
          </button>
        </div>
        {rechazo && <p className="aviso">{rechazo}</p>}
      </form>
    </main>
  )
}
