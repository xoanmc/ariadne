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
  editarAlumno: 'alumnos:editar',
  cursosDeAlumno: 'cursos:deAlumno',
  obtenerCurso: 'cursos:obtener',
  proponerCurso: 'cursos:proponer',
  abrirCurso: 'cursos:abrir',
  corregirCurso: 'cursos:corregir',
  evaluacionDeCurso: 'evaluaciones:deCurso',
  guardarEvaluacion: 'evaluaciones:guardar',
  sugerenciasDeInstrumento: 'evaluaciones:instrumentos',
  actasDeCurso: 'actas:deCurso',
  registrarActa: 'actas:registrar',
  corregirActa: 'actas:corregir',
  programaDeCurso: 'programas:deCurso',
  crearPrograma: 'programas:crear',
  editarContenidoPrograma: 'programas:editarContenido',
  anadirObjetivo: 'programas:anadirObjetivo'
} as const

export type Valoracion = 'sin_valorar' | 'conseguido' | 'no_conseguido' | 'pendiente_desarrollar'

/** Un objetivo puesto en un trimestre. La etiqueta viene del dominio, que es la única fuente del vocabulario. */
export interface VistaAsignacion {
  asignacionId: number
  objetivoId: number
  enunciado: string
  trimestreId: number
  numeroTrimestre: NumeroTrimestre
  valoracion: Valoracion
  etiquetaValoracion: string
  arrastrado: boolean
}

export interface VistaPrograma {
  id: number
  fechaCreacion: string
  fechaRevision: string | null
  contenido: string | null
  asignaciones: VistaAsignacion[]
}

export interface DatosObjetivo {
  enunciado: string
  trimestreId: number
}

export type ResultadoPrograma =
  | { tipo: 'guardado'; programa: VistaPrograma }
  | { tipo: 'invalido'; problemas: { campo: 'enunciado' | 'trimestre'; mensaje: string }[] }
  | { tipo: 'rechazado'; mensaje: string }

export interface DatosActa {
  fecha: string
  asistentes: string | null
  contenido: string | null
  acuerdos: string | null
}

export interface VistaActa extends DatosActa {
  id: number
}

export type CampoActa = keyof DatosActa

export interface ProblemaActa {
  campo: CampoActa
  mensaje: string
}

export type ResultadoActa =
  | { tipo: 'guardada'; acta: VistaActa }
  | { tipo: 'invalida'; problemas: ProblemaActa[] }
  | { tipo: 'rechazada'; mensaje: string }

export interface DatosEvaluacion {
  fecha: string
  instrumento: string | null
  contenido: string
}

export interface VistaEvaluacion extends DatosEvaluacion {
  id: number
}

export type CampoEvaluacion = keyof DatosEvaluacion

export interface ProblemaEvaluacion {
  campo: CampoEvaluacion
  mensaje: string
}

export type ResultadoEvaluacion =
  | { tipo: 'guardada'; evaluacion: VistaEvaluacion }
  | { tipo: 'invalida'; problemas: ProblemaEvaluacion[] }
  | { tipo: 'rechazada'; mensaje: string }

export type NumeroTrimestre = 1 | 2 | 3

export interface PeriodoTrimestre {
  numero: NumeroTrimestre
  fechaInicio: string
  fechaFin: string
}

export interface VistaTrimestre extends PeriodoTrimestre {
  id: number
  estado: 'abierto' | 'cerrado'
}

export interface VistaCurso {
  id: number
  alumnoId: number
  curso: string
  nivelEducativo: string | null
  estado: 'activo' | 'cerrado'
  cursoAnterior: string | null
  trimestres: VistaTrimestre[]
}

/** Lo que la aplicación propone al abrir curso, o por qué todavía no se puede abrir. */
export type PropuestaCurso =
  | { tipo: 'propuesta'; curso: string; periodos: PeriodoTrimestre[]; cursoAnterior: string | null }
  | { tipo: 'curso_activo'; curso: string }
  | { tipo: 'no_existe' }

export interface DatosCurso {
  curso: string
  nivelEducativo: string | null
  periodos: PeriodoTrimestre[]
}

export type CampoCurso = 'curso' | 'nivelEducativo' | 'trimestre1' | 'trimestre2' | 'trimestre3'

export interface ProblemaCurso {
  campo: CampoCurso
  mensaje: string
}

export type ResultadoCurso =
  | { tipo: 'guardado'; curso: VistaCurso }
  | { tipo: 'invalido'; problemas: ProblemaCurso[] }
  | { tipo: 'rechazado'; mensaje: string }

export interface FichaAlumno {
  id: number
  codigoInterno: string
  nombre: string
  apellidos: string
  fechaNacimiento: string | null
  diagnosticos: string | null
  notas: string | null
}

/** Una fila de la lista de alumnos: su ficha y, si lo tiene, su curso activo. */
export interface AlumnoEnLista extends FichaAlumno {
  cursoActivo: { curso: string; nivelEducativo: string | null } | null
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
    listar(): Promise<AlumnoEnLista[]>
    obtener(id: number): Promise<FichaAlumno | null>
    darDeAlta(datos: DatosAlumno, confirmarDuplicado: boolean): Promise<ResultadoAlta>
    editar(id: number, datos: DatosAlumno): Promise<ResultadoEdicion>
  }
  cursos: {
    deAlumno(alumnoId: number): Promise<VistaCurso[]>
    obtener(cursoId: number): Promise<VistaCurso | null>
    proponer(alumnoId: number, curso?: string): Promise<PropuestaCurso>
    abrir(alumnoId: number, datos: DatosCurso): Promise<ResultadoCurso>
    corregir(cursoId: number, datos: DatosCurso): Promise<ResultadoCurso>
  }
  evaluaciones: {
    deCurso(cursoId: number): Promise<VistaEvaluacion | null>
    guardar(cursoId: number, datos: DatosEvaluacion): Promise<ResultadoEvaluacion>
    sugerenciasDeInstrumento(): Promise<string[]>
  }
  actas: {
    deCurso(cursoId: number): Promise<VistaActa[]>
    registrar(cursoId: number, datos: DatosActa): Promise<ResultadoActa>
    corregir(actaId: number, datos: DatosActa): Promise<ResultadoActa>
  }
  programas: {
    deCurso(cursoId: number): Promise<VistaPrograma | null>
    crear(cursoId: number, contenido: string | null): Promise<ResultadoPrograma>
    editarContenido(programaId: number, contenido: string | null): Promise<ResultadoPrograma>
    anadirObjetivo(programaId: number, datos: DatosObjetivo): Promise<ResultadoPrograma>
  }
}
