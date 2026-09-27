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
    proponer: (alumnoId, curso) => ipcRenderer.invoke(CANALES.proponerCurso, alumnoId, curso),
    abrir: (alumnoId, datos) => ipcRenderer.invoke(CANALES.abrirCurso, alumnoId, datos),
    corregir: (cursoId, datos) => ipcRenderer.invoke(CANALES.corregirCurso, cursoId, datos)
  }
}

contextBridge.exposeInMainWorld('ariadne', api)
