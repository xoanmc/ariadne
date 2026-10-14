import { useEffect, useState } from 'react'
import type { NumeroTrimestre } from '../../compartido/ipc'
import { NOMBRE_TRIMESTRE } from './FormularioCurso'

/**
 * Al acabar el trimestre, un fichero por cada alumno con curso activo, en un solo paso (T6.2).
 * Propone el trimestre que se está cursando o, en vacaciones, el que acaba de terminar.
 */
export function ExportarTodos() {
  const [resumen, setResumen] = useState<{ alumnos: number; trimestre: NumeroTrimestre } | null>(null)
  const [numero, setNumero] = useState<NumeroTrimestre>(1)
  const [hecho, setHecho] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)

  useEffect(() => {
    window.ariadne.exportacion.resumenTodos().then((r) => {
      setResumen(r)
      setNumero(r.trimestre)
    })
  }, [])

  if (!resumen || resumen.alumnos === 0) return null

  async function exportar() {
    setOcupado(true)
    setHecho(null)
    setError(null)
    const resultado = await window.ariadne.exportacion.todos(numero)
    setOcupado(false)
    if (resultado.tipo === 'rechazado') return setError(resultado.mensaje)
    if (resultado.tipo === 'exportados') {
      const n = resultado.ficheros
      setHecho(`${n === 1 ? 'Guardado 1 fichero' : `Guardados ${n} ficheros`} en ${resultado.carpeta}.`)
    }
  }

  return (
    <section className="exportar-todos">
      <h2>Exportar el trimestre de todos</h2>
      <p className="apunte">
        Un fichero por cada alumno con curso activo ({resumen.alumnos}), con todo lo registrado en ese trimestre.
      </p>
      <div className="exportar-trimestre">
        <label>
          Trimestre{' '}
          <select value={numero} onChange={(e) => setNumero(Number(e.target.value) as NumeroTrimestre)}>
            {([1, 2, 3] as NumeroTrimestre[]).map((n) => (
              <option key={n} value={n}>
                {NOMBRE_TRIMESTRE[n]}
              </option>
            ))}
          </select>
        </label>
        <button onClick={exportar} disabled={ocupado}>
          Elegir carpeta y exportar
        </button>
      </div>
      {hecho && (
        <p className="confirmacion-breve">
          {hecho}{' '}
          <button className="enlace" onClick={() => window.ariadne.exportacion.mostrar()}>
            Abrir la carpeta
          </button>
        </p>
      )}
      {error && <p className="problema">{error}</p>}
    </section>
  )
}
