import { contextBridge, ipcRenderer } from 'electron'
import { CANALES, type AriadneApi } from '../compartido/ipc'

const api: AriadneApi = {
  datos: {
    estado: () => ipcRenderer.invoke(CANALES.estado),
    reintentar: () => ipcRenderer.invoke(CANALES.reintentar),
    cambiarUbicacion: () => ipcRenderer.invoke(CANALES.cambiarUbicacion),
    abrirExistente: () => ipcRenderer.invoke(CANALES.abrirExistente),
    buscarBase: () => ipcRenderer.invoke(CANALES.buscarBase),
    mostrarEnCarpeta: () => ipcRenderer.invoke(CANALES.mostrarEnCarpeta)
  },
  copias: {
    listar: () => ipcRenderer.invoke(CANALES.listarCopias),
    guardar: () => ipcRenderer.invoke(CANALES.guardarCopia),
    restaurar: (ruta) => ipcRenderer.invoke(CANALES.restaurarCopia, ruta),
    restaurarDesdeFichero: () => ipcRenderer.invoke(CANALES.restaurarDesdeFichero)
  },
  alumnos: {
    listar: () => ipcRenderer.invoke(CANALES.listarAlumnos),
    obtener: (id) => ipcRenderer.invoke(CANALES.obtenerAlumno, id),
    darDeAlta: (datos, confirmarDuplicado) => ipcRenderer.invoke(CANALES.darDeAlta, datos, confirmarDuplicado),
    editar: (id, datos) => ipcRenderer.invoke(CANALES.editarAlumno, id, datos)
  },
  cursos: {
    deAlumno: (alumnoId) => ipcRenderer.invoke(CANALES.cursosDeAlumno, alumnoId),
    obtener: (cursoId) => ipcRenderer.invoke(CANALES.obtenerCurso, cursoId),
    proponer: (alumnoId, curso) => ipcRenderer.invoke(CANALES.proponerCurso, alumnoId, curso),
    abrir: (alumnoId, datos) => ipcRenderer.invoke(CANALES.abrirCurso, alumnoId, datos),
    corregir: (cursoId, datos) => ipcRenderer.invoke(CANALES.corregirCurso, cursoId, datos)
  },
  evaluaciones: {
    deCurso: (cursoId) => ipcRenderer.invoke(CANALES.evaluacionDeCurso, cursoId),
    guardar: (cursoId, datos) => ipcRenderer.invoke(CANALES.guardarEvaluacion, cursoId, datos),
    sugerenciasDeInstrumento: () => ipcRenderer.invoke(CANALES.sugerenciasDeInstrumento)
  },
  actas: {
    deCurso: (cursoId) => ipcRenderer.invoke(CANALES.actasDeCurso, cursoId),
    registrar: (cursoId, datos) => ipcRenderer.invoke(CANALES.registrarActa, cursoId, datos),
    corregir: (actaId, datos) => ipcRenderer.invoke(CANALES.corregirActa, actaId, datos)
  },
  programas: {
    deCurso: (cursoId) => ipcRenderer.invoke(CANALES.programaDeCurso, cursoId),
    pendientesDelCursoAnterior: (cursoId) => ipcRenderer.invoke(CANALES.pendientesDelCursoAnterior, cursoId),
    crear: (cursoId, contenido, arrastrar) => ipcRenderer.invoke(CANALES.crearPrograma, cursoId, contenido, arrastrar),
    editarContenido: (programaId, contenido) => ipcRenderer.invoke(CANALES.editarContenidoPrograma, programaId, contenido),
    anadirObjetivo: (programaId, datos) => ipcRenderer.invoke(CANALES.anadirObjetivo, programaId, datos),
    editarObjetivo: (objetivoId, enunciado) => ipcRenderer.invoke(CANALES.editarObjetivo, objetivoId, enunciado),
    moverObjetivo: (asignacionId, trimestreId) => ipcRenderer.invoke(CANALES.moverObjetivo, asignacionId, trimestreId),
    quitarObjetivo: (objetivoId) => ipcRenderer.invoke(CANALES.quitarObjetivo, objetivoId)
  },
  catalogo: {
    listar: () => ipcRenderer.invoke(CANALES.catalogo),
    anadir: (categoria, texto) => ipcRenderer.invoke(CANALES.anadirOpcion, categoria, texto),
    renombrar: (opcionId, texto) => ipcRenderer.invoke(CANALES.renombrarOpcion, opcionId, texto),
    activar: (opcionId, activa) => ipcRenderer.invoke(CANALES.activarOpcion, opcionId, activa),
    mover: (opcionId, hacia) => ipcRenderer.invoke(CANALES.moverOpcion, opcionId, hacia)
  },
  sesiones: {
    registrar: (alumnoId, datos) => ipcRenderer.invoke(CANALES.registrarSesion, alumnoId, datos),
    objetivosPara: (alumnoId, fecha) => ipcRenderer.invoke(CANALES.objetivosParaSesion, alumnoId, fecha),
    deCurso: (cursoId) => ipcRenderer.invoke(CANALES.sesionesDeCurso, cursoId),
    obtener: (sesionId) => ipcRenderer.invoke(CANALES.obtenerSesion, sesionId),
    corregir: (sesionId, alumnoId, datos) => ipcRenderer.invoke(CANALES.corregirSesion, sesionId, alumnoId, datos),
    borrar: (sesionId) => ipcRenderer.invoke(CANALES.borrarSesion, sesionId)
  },
  exportacion: {
    trimestre: (trimestreId) => ipcRenderer.invoke(CANALES.exportarTrimestre, trimestreId),
    mostrar: () => ipcRenderer.invoke(CANALES.mostrarExportacion),
    resumenTodos: () => ipcRenderer.invoke(CANALES.resumenExportarTodos),
    todos: (numero) => ipcRenderer.invoke(CANALES.exportarTodos, numero)
  },
  calendario: {
    listar: () => ipcRenderer.invoke(CANALES.listarCalendarios),
    guardar: (curso, periodos) => ipcRenderer.invoke(CANALES.guardarCalendario, curso, periodos)
  },
  cierre: {
    verificacion: (trimestreId) => ipcRenderer.invoke(CANALES.verificacionTrimestre, trimestreId),
    valorar: (asignacionId, valoracion, comentario) => ipcRenderer.invoke(CANALES.valorarObjetivo, asignacionId, valoracion, comentario),
    cerrar: (trimestreId, arrastrar) => ipcRenderer.invoke(CANALES.cerrarTrimestre, trimestreId, arrastrar)
  }
}

contextBridge.exposeInMainWorld('ariadne', api)
