import { app, BrowserWindow, dialog, ipcMain, shell, type IpcMainInvokeEvent } from 'electron'
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { CANALES, type ResultadoCambio, type ResultadoCopia, type ResultadoExportacion, type ResultadoRestauracion } from '../../compartido/ipc'
import * as actas from '../servicios/actas'
import * as alumnos from '../servicios/alumnos'
import * as calendario from '../servicios/calendario'
import * as catalogo from '../servicios/catalogo'
import * as cierre from '../servicios/cierre'
import * as cursos from '../servicios/cursos'
import * as evaluaciones from '../servicios/evaluaciones'
import * as exportacion from '../servicios/exportacion'
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

  ipcMain.handle(CANALES.sesionesDeCurso, (_evento, cursoId: unknown) => sesiones.sesionesDeCurso(datos.conexion(), cursoId))

  ipcMain.handle(CANALES.obtenerSesion, (_evento, sesionId: unknown) => sesiones.obtenerSesion(datos.conexion(), sesionId))

  ipcMain.handle(CANALES.corregirSesion, (_evento, sesionId: unknown, alumnoId: unknown, entrada) =>
    sesiones.corregirSesion(datos.conexion(), sesionId, alumnoId, entrada)
  )

  ipcMain.handle(CANALES.borrarSesion, (_evento, sesionId: unknown) => sesiones.borrarSesion(datos.conexion(), sesionId))

  // La última exportación: "mostrar en la carpeta" solo abre lo que la aplicación acaba de escribir
  let ultimaExportacion: string | null = null

  ipcMain.handle(CANALES.exportarTrimestre, async (evento, trimestreId: unknown): Promise<ResultadoExportacion> => {
    const fichero = exportacion.exportacionDeTrimestre(datos.conexion(), trimestreId)
    if (!fichero) return { tipo: 'rechazado', mensaje: 'Ese trimestre no existe.' }
    const eleccion = await dialog.showSaveDialog(ventanaDe(evento), {
      title: 'Guardar el registro del trimestre',
      buttonLabel: 'Guardar',
      defaultPath: join(app.getPath('documents'), fichero.nombreFichero),
      filters: [{ name: 'Texto', extensions: ['txt'] }]
    })
    if (eleccion.canceled || !eleccion.filePath) return { tipo: 'cancelado' }
    try {
      // Con BOM: así cualquier programa de Windows lo abre con las tildes bien
      writeFileSync(eleccion.filePath, '\uFEFF' + fichero.texto, 'utf8')
    } catch {
      return { tipo: 'rechazado', mensaje: 'No se pudo guardar el fichero ahí. Prueba en otra carpeta, por ejemplo en Documentos.' }
    }
    ultimaExportacion = eleccion.filePath
    return { tipo: 'exportado', ruta: eleccion.filePath }
  })

  ipcMain.handle(CANALES.mostrarExportacion, () => {
    if (ultimaExportacion) shell.showItemInFolder(ultimaExportacion)
  })

  ipcMain.handle(CANALES.listarCalendarios, () => calendario.listarCalendarios(datos.conexion()))

  ipcMain.handle(CANALES.guardarCalendario, (_evento, curso: unknown, periodos: unknown) =>
    calendario.guardarCalendario(datos.conexion(), curso, periodos)
  )

  ipcMain.handle(CANALES.verificacionTrimestre, (_evento, trimestreId: unknown) =>
    cierre.verificacionDeTrimestre(datos.conexion(), trimestreId)
  )

  ipcMain.handle(CANALES.valorarObjetivo, (_evento, asignacionId: unknown, valoracion: unknown, comentario: unknown) =>
    cierre.valorarObjetivo(datos.conexion(), asignacionId, valoracion, comentario)
  )

  ipcMain.handle(CANALES.cerrarTrimestre, (_evento, trimestreId: unknown, arrastrar: unknown) =>
    cierre.cerrarTrimestre(datos.conexion(), trimestreId, arrastrar)
  )

  ipcMain.handle(CANALES.objetivosParaSesion, (_evento, alumnoId: unknown, fecha: unknown) =>
    sesiones.objetivosParaSesion(datos.conexion(), alumnoId, fecha)
  )
}
