import { useEffect, useState } from 'react'
import type { VistaCurso, VistaSesion } from '../../compartido/ipc'
import { fechaCorta } from '../fechas'
import { NOMBRE_TRIMESTRE } from './FormularioCurso'

interface Props {
  curso: VistaCurso
  onCorregir: (sesionId: number) => void
}

/** "8", o "8 · 1 falta": las faltas se cuentan aparte, porque no son sesiones trabajadas. */
function contar(sesiones: VistaSesion[]): string {
  const faltas = sesiones.filter((s) => s.falta).length
  const hechas = sesiones.length - faltas
  return faltas === 0 ? `${hechas}` : `${hechas} · ${faltas} ${faltas === 1 ? 'falta' : 'faltas'}`
}

/** Las sesiones de un trimestre en orden cronológico, como el diario que llevaba en Word. */
export function SesionesDelCurso({ curso, onCorregir }: Props) {
  const [sesiones, setSesiones] = useState<VistaSesion[] | null>(null)
  const [trimestreId, setTrimestreId] = useState<number>(curso.trimestreEnCursoId ?? curso.trimestres[0].id)
  const [borrando, setBorrando] = useState<number | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)

  useEffect(() => {
    window.ariadne.sesiones.deCurso(curso.id).then(setSesiones)
  }, [curso.id])

  async function borrar(id: number) {
    const resultado = await window.ariadne.sesiones.borrar(id)
    if (resultado.tipo === 'rechazada') return setAviso(resultado.mensaje)
    setBorrando(null)
    setAviso(null)
    setSesiones(await window.ariadne.sesiones.deCurso(curso.id))
  }

  if (!sesiones) return null
  const delTrimestre = sesiones.filter((s) => s.trimestreId === trimestreId)

  return (
    <div className="sesiones">
      <h2>Sesiones</h2>
      <div className="selector-trimestre" role="tablist">
        {curso.trimestres.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={t.id === trimestreId}
            className={t.id === trimestreId ? 'pestana activa' : 'pestana'}
            onClick={() => setTrimestreId(t.id)}
          >
            {NOMBRE_TRIMESTRE[t.numero]} ({contar(sesiones.filter((s) => s.trimestreId === t.id))})
          </button>
        ))}
      </div>

      {delTrimestre.length === 0 ? (
        <p className="apunte">No hay sesiones registradas en este trimestre.</p>
      ) : (
        <ol className="lista-sesiones">
          {delTrimestre.map((s) => (
            <li key={s.id} className={s.falta ? 'sesion falta' : 'sesion'}>
              <p className="cabecera-acta">
                <strong>{fechaCorta(s.fecha)}</strong>
                {s.falta && <span className="etiqueta etiqueta-falta">No acudió</span>}
              </p>
              {s.estadoAlumno.length > 0 && (
                <p><span className="subtitulo-linea">Estado:</span> {s.estadoAlumno.join(', ')}</p>
              )}
              {s.respuestaActividades.length > 0 && (
                <p><span className="subtitulo-linea">Respuesta:</span> {s.respuestaActividades.join(', ')}</p>
              )}
              {s.objetivos.length > 0 && (
                <p><span className="subtitulo-linea">Objetivos trabajados:</span> {s.objetivos.map((o) => o.enunciado).join(' · ')}</p>
              )}
              {s.observaciones &&
                (s.falta ? (
                  <p><span className="subtitulo-linea">Motivo:</span> {s.observaciones}</p>
                ) : (
                  <p className="texto-largo">{s.observaciones}</p>
                ))}
              {s.saludMedicacion && <p><span className="subtitulo-linea">Salud o medicación:</span> {s.saludMedicacion}</p>}

              {s.modificable &&
                (borrando === s.id ? (
                  <div className="acciones-objetivo">
                    <span>¿Borrar esta sesión?</span>
                    <button className="principal" onClick={() => borrar(s.id)}>Borrar</button>
                    <button onClick={() => setBorrando(null)}>Cancelar</button>
                    {aviso && <p className="problema">{aviso}</p>}
                  </div>
                ) : (
                  <div className="acciones-objetivo">
                    <button className="enlace" onClick={() => onCorregir(s.id)}>Corregir</button>
                    <button className="enlace" onClick={() => { setAviso(null); setBorrando(s.id) }}>Borrar</button>
                  </div>
                ))}
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}
