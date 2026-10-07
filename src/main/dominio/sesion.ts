import { esFecha, type UbicacionFecha } from './calendario'
import type { Fecha } from './entidades'

export type CampoSesion = 'fecha' | 'contenido'

export interface DatosSesion {
  fecha: Fecha
  objetivos: number[]
  estadoAlumno: string[]
  respuestaActividades: string[]
  observaciones: string | null
  incidencias: string | null
  saludMedicacion: string | null
}

export interface ProblemaSesion {
  campo: CampoSesion
  mensaje: string
}

const NOMBRE: Record<1 | 2 | 3, string> = { 1: '1.er trimestre', 2: '2.º trimestre', 3: '3.er trimestre' }

function texto(valor: unknown): string {
  return typeof valor === 'string' ? valor.trim() : ''
}

/** Las opciones marcadas, sin vacías ni repetidas, en el orden en que se marcaron. */
function opciones(valor: unknown): string[] {
  if (!Array.isArray(valor)) return []
  return [...new Set(valor.map(texto).filter((o) => o !== '' && o.length <= 60))]
}

export function normalizarSesion(entrada: Partial<Record<keyof DatosSesion, unknown>>): DatosSesion {
  return {
    fecha: texto(entrada.fecha),
    objetivos: Array.isArray(entrada.objetivos)
      ? [...new Set(entrada.objetivos.filter((id): id is number => Number.isInteger(id) && id > 0))]
      : [],
    estadoAlumno: opciones(entrada.estadoAlumno),
    respuestaActividades: opciones(entrada.respuestaActividades),
    observaciones: texto(entrada.observaciones) || null,
    incidencias: texto(entrada.incidencias) || null,
    saludMedicacion: texto(entrada.saludMedicacion) || null
  }
}

/** Se registra después de la sesión: la fecha no puede ser futura. Y una sesión sin nada dentro no es un registro. */
export function validarSesion(datos: DatosSesion, hoy: Fecha): ProblemaSesion[] {
  const problemas: ProblemaSesion[] = []
  if (!esFecha(datos.fecha)) problemas.push({ campo: 'fecha', mensaje: 'Indica la fecha de la sesión.' })
  else if (datos.fecha > hoy) problemas.push({ campo: 'fecha', mensaje: 'La fecha no puede ser posterior a hoy.' })

  const vacia =
    datos.estadoAlumno.length === 0 &&
    datos.respuestaActividades.length === 0 &&
    !datos.observaciones &&
    !datos.incidencias &&
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
