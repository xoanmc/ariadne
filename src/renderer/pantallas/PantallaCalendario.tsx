import { useEffect, useState } from 'react'
import type { PeriodoTrimestre, ProblemaCurso, VistaCalendario } from '../../compartido/ipc'
import { FechasTrimestres } from '../componentes/FechasTrimestres'

/**
 * Las fechas de los trimestres de cada curso escolar, comunes a todos sus alumnos. Se fijan una vez
 * y se aplican a todos; abrir un curso a un alumno ya no las pide.
 */
export function PantallaCalendario() {
  const [calendarios, setCalendarios] = useState<VistaCalendario[] | null>(null)

  useEffect(() => {
    window.ariadne.calendario.listar().then(setCalendarios)
  }, [])

  if (!calendarios) return null

  return (
    <main className="pantalla">
      <h1>Calendario</h1>
      <p className="apunte">
        Las fechas de los trimestres de cada curso, las mismas para todos tus alumnos. Entre un trimestre y otro puede
        haber vacaciones.
      </p>
      {calendarios.map((c) => (
        <CalendarioDeCurso key={c.curso} inicial={c} />
      ))}
    </main>
  )
}

function CalendarioDeCurso({ inicial }: { inicial: VistaCalendario }) {
  const [calendario, setCalendario] = useState(inicial)
  const [periodos, setPeriodos] = useState<PeriodoTrimestre[]>(inicial.periodos)
  const [problemas, setProblemas] = useState<ProblemaCurso[]>([])
  const [rechazo, setRechazo] = useState<string | null>(null)
  const [confirmacion, setConfirmacion] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)

  function cambiar(nuevos: PeriodoTrimestre[]) {
    setPeriodos(nuevos)
    setProblemas([])
    setRechazo(null)
    setConfirmacion(null)
  }

  async function guardar() {
    setOcupado(true)
    const resultado = await window.ariadne.calendario.guardar(calendario.curso, periodos)
    setOcupado(false)
    if (resultado.tipo === 'invalido') return setProblemas(resultado.problemas)
    if (resultado.tipo === 'rechazado') return setRechazo(resultado.mensaje)
    setCalendario(resultado.calendario)
    setPeriodos(resultado.calendario.periodos)
    const n = resultado.calendario.alumnos
    setConfirmacion(n === 0 ? 'Calendario guardado.' : `Calendario guardado: se aplica a ${n === 1 ? 'tu alumno' : `tus ${n} alumnos`} de ${calendario.curso}.`)
  }

  const cambiado = periodos.some((p, i) => p.fechaInicio !== calendario.periodos[i].fechaInicio || p.fechaFin !== calendario.periodos[i].fechaFin)
  const porAjustar = calendario.pendientesDeAjustar > 0

  return (
    <section className="seccion">
      <h2>Curso {calendario.curso}</h2>
      <p className="apunte">
        {!calendario.fijado
          ? 'Aún no lo has fijado: estas son fechas orientativas. Corrígelas con el calendario de tu centro y guárdalas.'
          : calendario.alumnos === 0
            ? 'Todavía no hay alumnos con este curso.'
            : calendario.alumnos === 1
              ? 'Lo sigue tu alumno de este curso.'
              : `Lo siguen tus ${calendario.alumnos} alumnos de este curso.`}
      </p>

      <FechasTrimestres periodos={periodos} problemas={problemas} bloqueados={calendario.cerrados} onCambiar={cambiar} />
      {calendario.cerrados.length > 0 && (
        <p className="apunte">Un trimestre que ya has cerrado a algún alumno conserva sus fechas.</p>
      )}

      {porAjustar && (
        <p className="apunte">
          {calendario.pendientesDeAjustar === 1 ? 'Un alumno tiene' : `${calendario.pendientesDeAjustar} alumnos tienen`} otras
          fechas: al guardar, se ajustarán a estas.
        </p>
      )}
      {calendario.conFechasPropias.length > 0 && (
        <div className="aviso-cierre">
          <p>Estos alumnos conservan sus propias fechas, porque ajustarlas descolocaría algo:</p>
          <ul>
            {calendario.conFechasPropias.map((a) => (
              <li key={a.alumno}>
                <strong>{a.alumno}</strong>: {a.motivo}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="acciones">
        <button className="principal" onClick={guardar} disabled={ocupado || (calendario.fijado && !cambiado && !porAjustar)}>
          {calendario.fijado ? 'Guardar cambios' : 'Fijar el calendario'}
        </button>
      </div>
      {rechazo && <p className="aviso">{rechazo}</p>}
      {confirmacion && <p className="confirmacion">{confirmacion}</p>}
    </section>
  )
}
