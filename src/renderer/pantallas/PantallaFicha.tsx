import { useEffect, useState } from 'react'
import type { DatosAlumno, FichaAlumno, ProblemaCampo } from '../../compartido/ipc'
import { FormularioAlumno } from '../componentes/FormularioAlumno'
import { SeccionCursos } from '../componentes/SeccionCursos'

interface Props {
  id: number
  recienCreado: boolean
  onVolver: () => void
  onAbrirCurso: (cursoId: number, recienAbierto: boolean) => void
}

function fechaLegible(fecha: string): string {
  return new Date(`${fecha}T00:00:00`).toLocaleDateString('es-ES', { dateStyle: 'long' })
}

function datosDe(alumno: FichaAlumno): DatosAlumno {
  const { nombre, apellidos, fechaNacimiento, diagnosticos, notas } = alumno
  return { nombre, apellidos, fechaNacimiento, diagnosticos, notas }
}

export function PantallaFicha({ id, recienCreado, onVolver, onAbrirCurso }: Props) {
  const [alumno, setAlumno] = useState<FichaAlumno | null | undefined>(undefined)
  const [editando, setEditando] = useState(false)
  const [problemas, setProblemas] = useState<ProblemaCampo[]>([])
  const [ocupado, setOcupado] = useState(false)
  const [guardado, setGuardado] = useState(false)

  useEffect(() => {
    window.ariadne.alumnos.obtener(id).then(setAlumno)
  }, [id])

  async function guardar(datos: DatosAlumno) {
    setOcupado(true)
    const resultado = await window.ariadne.alumnos.editar(id, datos)
    setOcupado(false)

    if (resultado.tipo === 'guardado') {
      setAlumno(resultado.alumno)
      setEditando(false)
      setProblemas([])
      setGuardado(true)
    } else if (resultado.tipo === 'invalido') {
      setProblemas(resultado.problemas)
    } else {
      setAlumno(null)
    }
  }

  if (alumno === undefined) return null
  if (alumno === null) {
    return (
      <main className="pantalla">
        <p className="aviso">Este alumno no existe.</p>
        <button onClick={onVolver}>Volver a los alumnos</button>
      </main>
    )
  }

  return (
    <main className="pantalla">
      <button className="volver" onClick={onVolver}>
        ← Alumnos
      </button>

      <div className="cabecera-ficha">
        <h1>
          {alumno.nombre} {alumno.apellidos}
        </h1>
        <span className="codigo codigo-grande">{alumno.codigoInterno}</span>
      </div>

      {recienCreado && !editando && !guardado && (
        <p className="confirmacion">
          Alta hecha. Su código es <strong>{alumno.codigoInterno}</strong>: es el que aparecerá en lugar de su nombre en
          todo lo que salga del equipo.
        </p>
      )}
      {guardado && !editando && <p className="confirmacion">Cambios guardados.</p>}

      {editando ? (
        <>
          <p className="apunte">El código {alumno.codigoInterno} no cambia al editar: es fijo para siempre.</p>
          <FormularioAlumno
            inicial={datosDe(alumno)}
            problemas={problemas}
            etiquetaGuardar="Guardar cambios"
            ocupado={ocupado}
            onGuardar={guardar}
            onCancelar={() => {
              setEditando(false)
              setProblemas([])
            }}
          />
        </>
      ) : (
        <>
          <dl className="ficha">
            <dt>Fecha de nacimiento</dt>
            <dd>{alumno.fechaNacimiento ? fechaLegible(alumno.fechaNacimiento) : <span className="apunte">Sin indicar</span>}</dd>
            <dt>Diagnósticos</dt>
            <dd>{alumno.diagnosticos ?? <span className="apunte">Sin indicar</span>}</dd>
            <dt>Notas</dt>
            <dd className="texto-largo">{alumno.notas ?? <span className="apunte">Sin notas</span>}</dd>
          </dl>
          <div className="acciones">
            <button
              onClick={() => {
                setEditando(true)
                setGuardado(false)
              }}
            >
              Editar
            </button>
          </div>

          <SeccionCursos alumnoId={alumno.id} onAbrirCurso={onAbrirCurso} />
        </>
      )}
    </main>
  )
}
