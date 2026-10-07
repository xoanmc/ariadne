import { app, BrowserWindow, dialog, ipcMain, shell, type IpcMainInvokeEvent } from 'electron'
import { join } from 'node:path'
import { CANALES, type ResultadoCambio, type ResultadoCopia, type ResultadoRestauracion } from '../../compartido/ipc'
import * as actas from '../servicios/actas'
import * as alumnos from '../servicios/alumnos'
import * as catalogo from '../servicios/catalogo'
import * as cursos from '../servicios/cursos'
import * as evaluaciones from '../servicios/evaluaciones'
import * as programas from '../servicios/programas'
import * as sesiones from '../servicios/sesiones'
import type { UbicacionDatos } from '../servicios/ubicacionDatos'

function ventanaDe(evento: IpcMainInvokeEvent): BrowserWindow {
  const ventana = BrowserWindow.fromWebContents(evento.sender)
  if (!ventana) throw new Error('Petición sin ventana de origen')
  return ventana
}

export function registrarManejadoresIpc(datos: UbicacionDatos): void {
  ipcMain.handle(CANALES.estado, () => datos.estado)

  ipcMain.handle(CANALES.reintentar, () => datos.reintentar())

  ipcMain.handle(CANALES.cambiarUbicacion, async (evento): Promise<ResultadoCambio> => {
    const eleccion = await dialog.showOpenDialog(ventanaDe(evento), {
      title: 'Elige la carpeta donde guardar tus datos',
      buttonLabel: 'Guardar aquí',
      properties: ['openDirectory', 'createDirectory']
    })
    if (eleccion.canceled || eleccion.filePaths.length === 0) return { tipo: 'cancelado' }
    return datos.moverA(eleccion.filePaths[0])
  })

  ipcMain.handle(CANALES.abrirExistente, () => datos.abrirExistente())

  ipcMain.handle(CANALES.buscarBase, async (evento): Promise<ResultadoCambio> => {
    const eleccion = await dialog.showOpenDialog(ventanaDe(evento), {
      title: 'Busca tu base de datos de Ariadne',
      buttonLabel: 'Abrir',
      properties: ['openFile'],
      filters: [
        { name: 'Base de datos de Ariadne', extensions: ['sqlite'] },
        { name: 'Todos los ficheros', extensions: ['*'] }
      ]
    })
    if (eleccion.canceled || eleccion.filePaths.length === 0) return { tipo: 'cancelado' }
    return datos.abrir(eleccion.filePaths[0])
  })

  ipcMain.handle(CANALES.mostrarEnCarpeta, () => {
    shell.showItemInFolder(datos.estado.ruta)
  })

  ipcMain.handle(CANALES.listarCopias, () => datos.copias())

  ipcMain.handle(CANALES.guardarCopia, async (evento): Promise<ResultadoCopia> => {
    const hoy = new Date().toISOString().slice(0, 10)
    const eleccion = await dialog.showSaveDialog(ventanaDe(evento), {
      title: 'Guardar una copia de tus datos',
      buttonLabel: 'Guardar copia',
      defaultPath: join(app.getPath('documents'), `ariadne-copia-${hoy}.sqlite`),
      filters: [{ name: 'Base de datos de Ariadne', extensions: ['sqlite'] }]
    })
    if (eleccion.canceled || !eleccion.filePath) return { tipo: 'cancelado' }
    return datos.guardarCopiaEn(eleccion.filePath)
  })

  ipcMain.handle(CANALES.restaurarCopia, (_evento, ruta: string) => datos.restaurarDesde(ruta))

  ipcMain.handle(CANALES.restaurarDesdeFichero, async (evento): Promise<ResultadoRestauracion> => {
    const eleccion = await dialog.showOpenDialog(ventanaDe(evento), {
      title: 'Elige la copia que quieres restaurar',
      buttonLabel: 'Restaurar',
      properties: ['openFile'],
      filters: [
        { name: 'Copia de Ariadne', extensions: ['sqlite'] },
        { name: 'Todos los ficheros', extensions: ['*'] }
      ]
    })
    if (eleccion.canceled || eleccion.filePaths.length === 0) return { tipo: 'cancelado' }
    return datos.restaurarDesde(eleccion.filePaths[0])
  })

  ipcMain.handle(CANALES.listarAlumnos, () => alumnos.listarAlumnos(datos.conexion()))

  ipcMain.handle(CANALES.obtenerAlumno, (_evento, id: unknown) => alumnos.obtenerAlumno(datos.conexion(), id))

  ipcMain.handle(CANALES.darDeAlta, (_evento, entrada, confirmarDuplicado: unknown) =>
    alumnos.darDeAlta(datos.conexion(), entrada, confirmarDuplicado === true)
  )

  ipcMain.handle(CANALES.editarAlumno, (_evento, id: unknown, entrada) =>
    alumnos.editarAlumno(datos.conexion(), id, entrada)
  )

  ipcMain.handle(CANALES.cursosDeAlumno, (_evento, alumnoId: unknown) =>
    cursos.cursosDeAlumno(datos.conexion(), alumnoId)
  )

  ipcMain.handle(CANALES.obtenerCurso, (_evento, cursoId: unknown) => cursos.obtenerCurso(datos.conexion(), cursoId))

  ipcMain.handle(CANALES.proponerCurso, (_evento, alumnoId: unknown, curso: unknown) =>
    cursos.proponerCurso(datos.conexion(), alumnoId, curso)
  )

  ipcMain.handle(CANALES.abrirCurso, (_evento, alumnoId: unknown, entrada) =>
    cursos.abrirCurso(datos.conexion(), alumnoId, entrada)
  )

  ipcMain.handle(CANALES.corregirCurso, (_evento, cursoId: unknown, entrada) =>
    cursos.corregirCurso(datos.conexion(), cursoId, entrada)
  )

  ipcMain.handle(CANALES.evaluacionDeCurso, (_evento, cursoId: unknown) =>
    evaluaciones.evaluacionDeCurso(datos.conexion(), cursoId)
  )

  ipcMain.handle(CANALES.guardarEvaluacion, (_evento, cursoId: unknown, entrada) =>
    evaluaciones.guardarEvaluacion(datos.conexion(), cursoId, entrada)
  )

  ipcMain.handle(CANALES.sugerenciasDeInstrumento, () => evaluaciones.sugerenciasDeInstrumento(datos.conexion()))

  ipcMain.handle(CANALES.actasDeCurso, (_evento, cursoId: unknown) => actas.actasDeCurso(datos.conexion(), cursoId))

  ipcMain.handle(CANALES.registrarActa, (_evento, cursoId: unknown, entrada) =>
    actas.registrarActa(datos.conexion(), cursoId, entrada)
  )

  ipcMain.handle(CANALES.corregirActa, (_evento, actaId: unknown, entrada) =>
    actas.corregirActa(datos.conexion(), actaId, entrada)
  )

  ipcMain.handle(CANALES.programaDeCurso, (_evento, cursoId: unknown) => programas.programaDeCurso(datos.conexion(), cursoId))

  ipcMain.handle(CANALES.crearPrograma, (_evento, cursoId: unknown, contenido: unknown, arrastrar: unknown) =>
    programas.crearPrograma(datos.conexion(), cursoId, contenido, arrastrar)
  )

  ipcMain.handle(CANALES.editarObjetivo, (_evento, objetivoId: unknown, enunciado: unknown) =>
    programas.editarObjetivo(datos.conexion(), objetivoId, enunciado)
  )

  ipcMain.handle(CANALES.moverObjetivo, (_evento, asignacionId: unknown, trimestreId: unknown) =>
    programas.moverObjetivo(datos.conexion(), asignacionId, trimestreId)
  )

  ipcMain.handle(CANALES.quitarObjetivo, (_evento, objetivoId: unknown) => programas.quitarObjetivo(datos.conexion(), objetivoId))

  ipcMain.handle(CANALES.pendientesDelCursoAnterior, (_evento, cursoId: unknown) =>
    programas.pendientesDelCursoAnterior(datos.conexion(), cursoId)
  )

  ipcMain.handle(CANALES.editarContenidoPrograma, (_evento, programaId: unknown, contenido: unknown) =>
    programas.editarContenido(datos.conexion(), programaId, contenido)
  )

  ipcMain.handle(CANALES.anadirObjetivo, (_evento, programaId: unknown, entrada) =>
    programas.anadirObjetivo(datos.conexion(), programaId, entrada)
  )

  ipcMain.handle(CANALES.catalogo, () => catalogo.listarCatalogo(datos.conexion()))

  ipcMain.handle(CANALES.anadirOpcion, (_evento, categoria: unknown, texto: unknown) =>
    catalogo.anadirOpcion(datos.conexion(), categoria, texto)
  )

  ipcMain.handle(CANALES.renombrarOpcion, (_evento, opcionId: unknown, texto: unknown) =>
    catalogo.renombrarOpcion(datos.conexion(), opcionId, texto)
  )

  ipcMain.handle(CANALES.activarOpcion, (_evento, opcionId: unknown, activa: unknown) =>
    catalogo.activarOpcion(datos.conexion(), opcionId, activa)
  )

  ipcMain.handle(CANALES.moverOpcion, (_evento, opcionId: unknown, hacia: unknown) =>
    catalogo.moverOpcion(datos.conexion(), opcionId, hacia)
  )

  ipcMain.handle(CANALES.registrarSesion, (_evento, alumnoId: unknown, entrada) =>
    sesiones.registrarSesion(datos.conexion(), alumnoId, entrada)
  )

  ipcMain.handle(CANALES.objetivosParaSesion, (_evento, alumnoId: unknown, fecha: unknown) =>
    sesiones.objetivosParaSesion(datos.conexion(), alumnoId, fecha)
  )
}
