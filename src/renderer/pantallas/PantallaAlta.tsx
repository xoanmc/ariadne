import { useState } from 'react'
import type { DatosAlumno, FichaAlumno, ProblemaCampo } from '../../compartido/ipc'
import { ALUMNO_VACIO, FormularioAlumno } from '../componentes/FormularioAlumno'

interface Props {
  onCreado: (id: number) => void
  onCancelar: () => void
}

export function PantallaAlta({ onCreado, onCancelar }: Props) {
  const [problemas, setProblemas] = useState<ProblemaCampo[]>([])
  const [duplicados, setDuplicados] = useState<{ datos: DatosAlumno; coincidencias: FichaAlumno[] } | null>(null)
  const [ocupado, setOcupado] = useState(false)

  async function guardar(datos: DatosAlumno, confirmarDuplicado = false) {
    setOcupado(true)
    const resultado = await window.ariadne.alumnos.darDeAlta(datos, confirmarDuplicado)
    setOcupado(false)

    if (resultado.tipo === 'creado') return onCreado(resultado.alumno.id)
    if (resultado.tipo === 'invalido') {
      setDuplicados(null)
      return setProblemas(resultado.problemas)
    }
    setProblemas([])
    setDuplicados({ datos, coincidencias: resultado.coincidencias })
  }

  return (
    <main className="pantalla">
      <h1>Dar de alta a un alumno</h1>
      <p className="apunte">
        Ariadne le asignará un código al guardar. Ese código es el que sustituye a su nombre en todo lo que salga del
        equipo, y no cambia nunca.
      </p>

      <FormularioAlumno
        inicial={ALUMNO_VACIO}
        problemas={problemas}
        etiquetaGuardar="Dar de alta"
        ocupado={ocupado}
        onGuardar={(datos) => guardar(datos)}
        onCancelar={onCancelar}
      />

      {duplicados && (
        <div className="pregunta">
          <p>Ya hay {duplicados.coincidencias.length === 1 ? 'un alumno' : 'alumnos'} con ese nombre y apellidos:</p>
          <ul>
            {duplicados.coincidencias.map((a) => (
              <li key={a.id}>
                {a.nombre} {a.apellidos} <span className="codigo">{a.codigoInterno}</span>
              </li>
            ))}
          </ul>
          <p>Si es otra persona, puedes darla de alta igualmente. Si es la misma, no hace falta: ya está.</p>
          <div className="acciones">
            <button className="principal" disabled={ocupado} onClick={() => guardar(duplicados.datos, true)}>
              Es otra persona, dar de alta
            </button>
            <button onClick={() => setDuplicados(null)}>Revisar</button>
          </div>
        </div>
      )}
    </main>
  )
}
