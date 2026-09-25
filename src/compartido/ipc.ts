export const CANALES = {
  estado: 'datos:estado',
  reintentar: 'datos:reintentar',
  cambiarUbicacion: 'datos:cambiarUbicacion',
  abrirExistente: 'datos:abrirExistente',
  buscarBase: 'datos:buscarBase',
  mostrarEnCarpeta: 'datos:mostrarEnCarpeta',
  listarCopias: 'copias:listar',
  guardarCopia: 'copias:guardar',
  restaurarCopia: 'copias:restaurar',
  restaurarDesdeFichero: 'copias:restaurarDesdeFichero',
  listarAlumnos: 'alumnos:listar',
  obtenerAlumno: 'alumnos:obtener',
  darDeAlta: 'alumnos:alta',
  editarAlumno: 'alumnos:editar'
} as const

export interface FichaAlumno {
  id: number
  codigoInterno: string
  nombre: string
  apellidos: string
  fechaNacimiento: string | null
  diagnosticos: string | null
  notas: string | null
}

/** Lo que ella rellena. El código no viaja nunca de la interfaz al proceso principal. */
export interface DatosAlumno {
  nombre: string
  apellidos: string
  fechaNacimiento: string | null
  diagnosticos: string | null
  notas: string | null
}

export type CampoAlumno = keyof DatosAlumno

export interface ProblemaCampo {
  campo: CampoAlumno
  mensaje: string
}

export type ResultadoAlta =
  | { tipo: 'creado'; alumno: FichaAlumno }
  | { tipo: 'posible_duplicado'; coincidencias: FichaAlumno[] }
  | { tipo: 'invalido'; problemas: ProblemaCampo[] }

export type ResultadoEdicion =
  | { tipo: 'guardado'; alumno: FichaAlumno }
  | { tipo: 'invalido'; problemas: ProblemaCampo[] }
  | { tipo: 'no_existe' }

export type EstadoDatos =
  | { tipo: 'lista'; ruta: string; avisoCopia?: string }
  | { tipo: 'ausente'; ruta: string }
  | { tipo: 'error'; ruta: string; mensaje: string }

export interface Copia {
  ruta: string
  nombre: string
  fecha: string
  tamano: number
}

export type ResultadoCopia =
  | { tipo: 'cancelado' }
  | { tipo: 'guardada'; ruta: string }
  | { tipo: 'error'; mensaje: string }

export type ResultadoRestauracion =
  | { tipo: 'cancelado' }
  | { tipo: 'restaurada'; ruta: string; copiaPrevia: string }
  | { tipo: 'error'; mensaje: string }

export type ResultadoCambio =
  | { tipo: 'cancelado' }
  | { tipo: 'movida'; ruta: string }
  | { tipo: 'abierta'; ruta: string }
  | { tipo: 'existe'; ruta: string }
  | { tipo: 'error'; mensaje: string }

export interface AriadneApi {
  datos: {
    estado(): Promise<EstadoDatos>
    reintentar(): Promise<EstadoDatos>
    cambiarUbicacion(): Promise<ResultadoCambio>
    abrirExistente(): Promise<ResultadoCambio>
    buscarBase(): Promise<ResultadoCambio>
    mostrarEnCarpeta(): Promise<void>
  }
  copias: {
    listar(): Promise<Copia[]>
    guardar(): Promise<ResultadoCopia>
    restaurar(ruta: string): Promise<ResultadoRestauracion>
    restaurarDesdeFichero(): Promise<ResultadoRestauracion>
  }
  alumnos: {
    listar(): Promise<FichaAlumno[]>
    obtener(id: number): Promise<FichaAlumno | null>
    darDeAlta(datos: DatosAlumno, confirmarDuplicado: boolean): Promise<ResultadoAlta>
    editar(id: number, datos: DatosAlumno): Promise<ResultadoEdicion>
  }
}
