import type { EstadoCurso, EstadoTrimestre, Valoracion } from './vocabulario'

/** Fecha en formato AAAA-MM-DD. Se compara y ordena como texto. */
export type Fecha = string

export type NumeroTrimestre = 1 | 2 | 3

export type TipoDocumento =
  | 'diario'
  | 'evaluacion_inicial'
  | 'programa'
  | 'informe_trimestral'
  | 'acta_reunion'
  | 'informe_externo'

export interface Alumno {
  id: number
  codigoInterno: string
  nombre: string
  apellidos: string
  fechaNacimiento: Fecha | null
  diagnosticos: string | null
  notas: string | null
}

export interface CursoAcademico {
  id: number
  alumnoId: number
  curso: string
  nivelEducativo: string | null
  estado: EstadoCurso
  cursoAnteriorId: number | null
}

export interface Trimestre {
  id: number
  cursoAcademicoId: number
  numero: NumeroTrimestre
  fechaInicio: Fecha
  fechaFin: Fecha
  estado: EstadoTrimestre
}

export interface EvaluacionInicial {
  id: number
  cursoAcademicoId: number
  fecha: Fecha
  contenido: string
  instrumento: string | null
}

export interface ProgramaIntervencion {
  id: number
  cursoAcademicoId: number
  fechaCreacion: Fecha
  fechaRevision: Fecha | null
  contenido: string | null
}

export interface Objetivo {
  id: number
  programaId: number
  enunciado: string
  fechaCreacion: Fecha
}

/** Pieza central: un objetivo puesto en un trimestre, con su valoración. Es lo único que cruza trimestres y cursos. */
export interface AsignacionTrimestral {
  id: number
  objetivoId: number
  trimestreId: number
  valoracion: Valoracion
  comentario: string | null
  asignacionAnteriorId: number | null
}

export interface Sesion {
  id: number
  alumnoId: number
  trimestreId: number
  fecha: Fecha
  estadoAlumno: string | null
  respuestaActividades: string | null
  observaciones: string | null
  saludMedicacion: string | null
  /** El alumno no acudió: no hay estado, respuesta, salud ni objetivos trabajados. */
  falta: boolean
}

export interface ActaReunion {
  id: number
  cursoAcademicoId: number
  fecha: Fecha
  asistentes: string | null
  contenido: string | null
  acuerdos: string | null
}

export interface Area {
  id: number
  nombre: string
  activa: boolean
}

export interface DocumentoGenerado {
  id: number
  tipo: TipoDocumento
  alumnoId: number
  cursoAcademicoId: number
  trimestreId: number | null
  fecha: string
  contenido: string | null
  rutaFichero: string | null
}

export interface Plantilla {
  id: number
  tipoDocumento: TipoDocumento
  rutaFichero: string
  activa: boolean
}

export type CategoriaCatalogo = 'estado_alumno' | 'respuesta_actividades'

export interface OpcionCatalogo {
  id: number
  categoria: CategoriaCatalogo
  texto: string
  orden: number
  activa: boolean
}
