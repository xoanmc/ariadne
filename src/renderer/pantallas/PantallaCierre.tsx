import { useEffect, useState } from 'react'
import type { ObjetivoEnCierre, Valoracion, VistaVerificacion } from '../../compartido/ipc'
import { fechaCorta, hoy } from '../fechas'

interface Props {
  trimestreId: number
  onVolver: (cursoId: number, aviso?: string) => void
}

const veces = (n: number, una: string, varias: string) => (n === 1 ? `1 ${una}` : `${n} ${varias}`)

/**
 * La pantalla única de cierre (T5.4): valorar cada objetivo con los datos delante, ver en vivo lo que
 * falta y cerrar. Cada valoración se guarda al pulsarla; solo las casillas de arrastre esperan al cierre.
 */
export function PantallaCierre({ trimestreId, onVolver }: Props) {
  const [verificacion, setVerificacion] = useState<VistaVerificacion | null | undefined>(undefined)
  const [alumno, setAlumno] = useState<string | null>(null)
  const [desmarcados, setDesmarcados] = useState<Set<number>>(new Set())
  const [comentando, setComentando] = useState<Record<number, string>>({})
  const [confirmando, setConfirmando] = useState(false)
  const [rechazo, setRechazo] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)

  useEffect(() => {
    window.ariadne.cierre.verificacion(trimestreId).then(async (v) => {
      setVerificacion(v)
      const curso = v && (await window.ariadne.cursos.obtener(v.cursoId))
      const ficha = curso && (await window.ariadne.alumnos.obtener(curso.alumnoId))
      if (ficha) setAlumno(`${ficha.nombre} ${ficha.apellidos}`)
    })
  }, [trimestreId])

  async function valorar(objetivo: ObjetivoEnCierre, valoracion: Valoracion, comentario: string | null) {
    const resultado = await window.ariadne.cierre.valorar(objetivo.asignacionId, valoracion, comentario)
    if (resultado.tipo === 'rechazado') return setRechazo(resultado.mensaje)
    setRechazo(null)
    setConfirmando(false)
    setVerificacion(resultado.verificacion)
  }

  /** Pulsar la valoración que ya tiene la deshace: vuelve a quedar sin valorar. */
  function elegir(objetivo: ObjetivoEnCierre, valoracion: Valoracion) {
    valorar(objetivo, objetivo.valoracion === valoracion ? 'sin_valorar' : valoracion, objetivo.comentario)
  }

  function guardarComentario(objetivo: ObjetivoEnCierre) {
    const texto = comentando[objetivo.asignacionId]
    if (texto === undefined || texto.trim() === (objetivo.comentario ?? '')) return
    valorar(objetivo, objetivo.valoracion, texto)
  }

  function alternarArrastre(asignacionId: number) {
    setConfirmando(false)
    setDesmarcados((actuales) => {
      const nuevos = new Set(actuales)
      if (nuevos.has(asignacionId)) nuevos.delete(asignacionId)
      else nuevos.add(asignacionId)
      return nuevos
    })
  }

  if (verificacion === undefined) return null
  if (verificacion === null) {
    return (
      <main className="pantalla">
        <p className="aviso">Este trimestre no existe.</p>
      </main>
    )
  }

  const v = verificacion
  const arrastrar = v.objetivos.filter((o) => o.arrastrable && !desmarcados.has(o.asignacionId)).map((o) => o.asignacionId)
  const antesDeTiempo = hoy() < v.fechaFin

  async function cerrar() {
    setOcupado(true)
    const resultado = await window.ariadne.cierre.cerrar(v.trimestreId, arrastrar)
    setOcupado(false)
    if (resultado.tipo === 'rechazado') {
      setConfirmando(false)
      return setRechazo(resultado.mensaje)
    }
    onVolver(v.cursoId, resultado.resumen)
  }

  return (
    <main className="pantalla">
      <button className="volver" onClick={() => onVolver(v.cursoId)}>
        ← Curso {v.curso}
      </button>
      <h1>Cierre del {v.nombreTrimestre}</h1>
      {alumno && <p className="apunte">{alumno}</p>}

      <div className="resumen-cierre" aria-live="polite">
        <span>
          {veces(v.sesiones, 'sesión', 'sesiones')}
          {v.faltas > 0 && ` y ${veces(v.faltas, 'falta', 'faltas')}`}
        </span>
        {v.objetivos.length > 0 && (
          <>
            <span className={v.sinValorar > 0 ? 'pendiente-cierre' : 'hecho-cierre'}>
              {v.sinValorar === 0
                ? 'Todo valorado'
                : v.sinValorar === 1
                  ? 'Falta 1 objetivo por valorar'
                  : `Faltan ${v.sinValorar} objetivos por valorar`}
            </span>
            {v.sinSesiones > 0 && <span>{veces(v.sinSesiones, 'objetivo sin ninguna sesión', 'objetivos sin ninguna sesión')}</span>}
            {v.noTrabajados > 0 && <span>{veces(v.noTrabajados, 'pendiente de desarrollar', 'pendientes de desarrollar')}</span>}
          </>
        )}
      </div>

      {v.objetivos.length === 0 ? (
        <p className="apunte">Este trimestre no tiene objetivos: solo queda cerrarlo.</p>
      ) : (
        <ol className="objetivos-cierre">
          {v.objetivos.map((o) => (
            <li key={o.asignacionId} className="objetivo-cierre">
              <div className="fila-objetivo">
                <span className="texto-largo">{o.enunciado}</span>
                <span className="detalle-objetivo">
                  {o.arrastrado && <span className="etiqueta etiqueta-arrastrado">arrastrado</span>}
                  <span className="apunte">
                    {o.sesiones === 0 ? 'sin sesiones' : `trabajado en ${veces(o.sesiones, 'sesión', 'sesiones')}`}
                  </span>
                </span>
              </div>

              <div className="chips" role="group" aria-label={`Valoración de ${o.enunciado}`}>
                {v.valoraciones.map(({ valor, etiqueta }) => (
                  <button
                    key={valor}
                    type="button"
                    className={o.valoracion === valor ? 'chip marcada' : 'chip'}
                    aria-pressed={o.valoracion === valor}
                    disabled={!v.abierto}
                    onClick={() => elegir(o, valor)}
                  >
                    {etiqueta}
                  </button>
                ))}
              </div>

              {o.estancado && <p className="aviso-cierre aviso-estancado">{o.estancado}</p>}
              {o.aviso && <p className="aviso-cierre">{o.aviso}</p>}

              {comentando[o.asignacionId] !== undefined || o.comentario ? (
                <textarea
                  aria-label={`Comentario sobre ${o.enunciado}`}
                  rows={2}
                  placeholder="Comentario (opcional)"
                  disabled={!v.abierto}
                  value={comentando[o.asignacionId] ?? o.comentario ?? ''}
                  onChange={(e) => setComentando((c) => ({ ...c, [o.asignacionId]: e.target.value }))}
                  onBlur={() => guardarComentario(o)}
                />
              ) : (
                v.abierto && (
                  <button className="enlace" onClick={() => setComentando((c) => ({ ...c, [o.asignacionId]: '' }))}>
                    Añadir comentario
                  </button>
                )
              )}

              {o.arrastrable && (
                <label className="pendiente casilla-arrastre">
                  <input type="checkbox" checked={!desmarcados.has(o.asignacionId)} onChange={() => alternarArrastre(o.asignacionId)} />
                  Pasar al {v.nombreSiguiente}
                </label>
              )}
            </li>
          ))}
        </ol>
      )}

      {v.cerrable &&
        (confirmando ? (
          <div className="confirmar-cierre">
            <p>
              Vas a cerrar el {v.nombreTrimestre}.{' '}
              {v.nombreSiguiente &&
                (arrastrar.length === 0
                  ? `No pasa ningún objetivo al ${v.nombreSiguiente}.`
                  : `Pasan al ${v.nombreSiguiente}: ${veces(arrastrar.length, 'objetivo', 'objetivos')}.`)}{' '}
              Después ya no podrás cambiar sus valoraciones ni sus sesiones
              {v.nombreSiguiente === null ? `, y el curso ${v.curso} quedará cerrado.` : '.'}
            </p>
            {antesDeTiempo && (
              <p className="apunte">
                El trimestre acaba el {fechaCorta(v.fechaFin)}: las sesiones que registres hasta entonces ya no podrán ir a él.
              </p>
            )}
            <div className="acciones">
              <button className="principal" onClick={cerrar} disabled={ocupado}>
                Cerrar el {v.nombreTrimestre}
              </button>
              <button onClick={() => setConfirmando(false)} disabled={ocupado}>
                Cancelar
              </button>
            </div>
          </div>
        ) : (
          <div className="acciones">
            <button className="principal" disabled={!v.puedeCerrarse} onClick={() => setConfirmando(true)}>
              Cerrar el {v.nombreTrimestre}
            </button>
            {!v.puedeCerrarse && <span className="apunte">Primero valora todos los objetivos.</span>}
          </div>
        ))}
      {!v.abierto && <p className="apunte">Este trimestre ya está cerrado.</p>}
      {rechazo && <p className="aviso">{rechazo}</p>}
    </main>
  )
}
