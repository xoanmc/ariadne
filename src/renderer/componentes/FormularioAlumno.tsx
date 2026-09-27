import { useState, type FormEvent, type ReactNode } from 'react'
import type { CampoAlumno, DatosAlumno, ProblemaCampo } from '../../compartido/ipc'
import { hoy } from '../fechas'

interface Props {
  inicial: DatosAlumno
  problemas: ProblemaCampo[]
  etiquetaGuardar: string
  ocupado: boolean
  onGuardar: (datos: DatosAlumno) => void
  onCancelar: () => void
}

export const ALUMNO_VACIO: DatosAlumno = {
  nombre: '',
  apellidos: '',
  fechaNacimiento: null,
  diagnosticos: null,
  notas: null
}

export function FormularioAlumno({ inicial, problemas, etiquetaGuardar, ocupado, onGuardar, onCancelar }: Props) {
  const [datos, setDatos] = useState<DatosAlumno>(inicial)

  function cambiar(nombre: CampoAlumno, valor: string) {
    setDatos((actual) => ({ ...actual, [nombre]: valor }))
  }

  function enviar(evento: FormEvent) {
    evento.preventDefault()
    onGuardar(datos)
  }

  // Función y no componente: un componente declarado aquí dentro se volvería a montar en cada tecla y el campo perdería el foco.
  function campo(nombre: CampoAlumno, etiqueta: string, control: ReactNode) {
    const problema = problemas.find((p) => p.campo === nombre)?.mensaje
    return (
      <div className={problema ? 'campo con-problema' : 'campo'}>
        <label htmlFor={nombre}>{etiqueta}</label>
        {control}
        {problema && <p className="problema">{problema}</p>}
      </div>
    )
  }

  return (
    <form className="formulario" onSubmit={enviar} noValidate>
      <div className="fila-campos">
        {campo(
          'nombre',
          'Nombre',
          <input id="nombre" value={datos.nombre} onChange={(e) => cambiar('nombre', e.target.value)} autoFocus />
        )}
        {campo(
          'apellidos',
          'Apellidos',
          <input id="apellidos" value={datos.apellidos} onChange={(e) => cambiar('apellidos', e.target.value)} />
        )}
      </div>

      {campo(
        'fechaNacimiento',
        'Fecha de nacimiento (opcional)',
        <input
          id="fechaNacimiento"
          type="date"
          max={hoy()}
          value={datos.fechaNacimiento ?? ''}
          onChange={(e) => cambiar('fechaNacimiento', e.target.value)}
        />
      )}

      {campo(
        'diagnosticos',
        'Diagnósticos (opcional)',
        <textarea
          id="diagnosticos"
          rows={2}
          value={datos.diagnosticos ?? ''}
          onChange={(e) => cambiar('diagnosticos', e.target.value)}
        />
      )}

      {campo(
        'notas',
        'Notas que no dependen del curso (opcional)',
        <textarea id="notas" rows={4} value={datos.notas ?? ''} onChange={(e) => cambiar('notas', e.target.value)} />
      )}

      <div className="acciones">
        <button type="submit" className="principal" disabled={ocupado}>
          {etiquetaGuardar}
        </button>
        <button type="button" onClick={onCancelar} disabled={ocupado}>
          Cancelar
        </button>
      </div>
    </form>
  )
}
