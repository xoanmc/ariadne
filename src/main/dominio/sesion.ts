import { esFecha, NOMBRE_TRIMESTRE as NOMBRE, type UbicacionFecha } from './calendario'
import type { Fecha } from './entidades'

export type CampoSesion = 'fecha' | 'contenido'

export interface DatosSesion {
  fecha: Fecha
  objetivos: number[]
  estadoAlumno: string[]
  respuestaActividades: string[]
  observaciones: string | null
  saludMedicacion: string | null
  /** El alumno no acudió. Las observaciones sirven entonces para el motivo. */
  falta: boolean
}

export interface ProblemaSesion {
  campo: CampoSesion
  mensaje: string
}

function texto(valor: unknown): string {
  return typeof valor === 'string' ? valor.trim() : ''
}

/** Las opciones marcadas, sin vacías ni repetidas, en el orden en que se marcaron. */
function opciones(valor: unknown): string[] {
  if (!Array.isArray(valor)) return []
  return [...new Set(valor.map(texto).filter((o) => o !== '' && o.length <= 60))]
}

/**
 * Una falta solo conserva la fecha y el motivo: lo que hubiera marcado antes de darse cuenta de que el
 * alumno no vino se descarta aquí, para que no llegue a guardarse.
 */
export function normalizarSesion(entrada: Partial<Record<keyof DatosSesion, unknown>>): DatosSesion {
  const falta = entrada.falta === true
  if (falta) {
    return {
      fecha: texto(entrada.fecha),
      objetivos: [],
      estadoAlumno: [],
      respuestaActividades: [],
      observaciones: texto(entrada.observaciones) || null,
      saludMedicacion: null,
      falta
    }
  }
  return {
    fecha: texto(entrada.fecha),
    objetivos: Array.isArray(entrada.objetivos)
      ? [...new Set(entrada.objetivos.filter((id): id is number => Number.isInteger(id) && id > 0))]
      : [],
    estadoAlumno: opciones(entrada.estadoAlumno),
    respuestaActividades: opciones(entrada.respuestaActividades),
    observaciones: texto(entrada.observaciones) || null,
    saludMedicacion: texto(entrada.saludMedicacion) || null,
    falta
  }
}

/**
 * Se registra después de la sesión: la fecha no puede ser futura. Y una sesión sin nada dentro no es un
 * registro, salvo una falta, que ya dice lo que pasó.
 */
export function validarSesion(datos: DatosSesion, hoy: Fecha): ProblemaSesion[] {
  const problemas: ProblemaSesion[] = []
  if (!esFecha(datos.fecha)) problemas.push({ campo: 'fecha', mensaje: 'Indica la fecha de la sesión.' })
  else if (datos.fecha > hoy) problemas.push({ campo: 'fecha', mensaje: 'La fecha no puede ser posterior a hoy.' })

  const vacia =
    !datos.falta &&
    datos.estadoAlumno.length === 0 &&
    datos.respuestaActividades.length === 0 &&
    !datos.observaciones &&
    !datos.saludMedicacion
  if (vacia) problemas.push({ campo: 'contenido', mensaje: 'Marca alguna opción o escribe algo sobre la sesión.' })
  return problemas
}

/** Las opciones marcadas se guardan como el texto que ella ve: así no cambian aunque luego corrija la lista. */
export function unirOpciones(marcadas: readonly string[]): string | null {
  return marcadas.length === 0 ? null : marcadas.join(', ')
}

/**
 * El trimestre no se pregunta: se deduce de la fecha. Si cae en vacaciones o fuera del curso, casi
 * seguro es una fecha mal escrita, y se avisa en lugar de colocarla en silencio donde no toca.
 */
export function problemaDeUbicacion(ubicacion: UbicacionFecha): string | null {
  switch (ubicacion.tipo) {
    case 'dentro':
      return null
    case 'vacaciones':
      return `Esa fecha cae en vacaciones, entre el ${NOMBRE[ubicacion.trasNumero]} y el ${NOMBRE[ubicacion.antesDeNumero]}: revisa la fecha.`
    case 'antes_del_curso':
      return 'Esa fecha es anterior al primer trimestre del curso: revisa la fecha.'
    case 'despues_del_curso':
      return 'Esa fecha es posterior al último trimestre del curso: revisa la fecha.'
  }
}
