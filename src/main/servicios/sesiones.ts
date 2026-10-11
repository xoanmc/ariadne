import type { DatosSesion, ObjetivosParaSesion, ResultadoSesion, VistaSesion } from '../../compartido/ipc'
import { situarFecha } from '../dominio/calendario'
import type { Alumno, Fecha, Trimestre } from '../dominio/entidades'
import { normalizarSesion, problemaDeUbicacion, unirOpciones, validarSesion, type DatosSesion as Datos } from '../dominio/sesion'
import type { BaseDatos } from '../persistencia/baseDatos'
import { obtenerAlumno } from '../persistencia/repositorioAlumnos'
import { cursosActivos, obtenerCurso, obtenerTrimestre, trimestresDeCurso } from '../persistencia/repositorioCursos'
import * as repositorio from '../persistencia/repositorioSesiones'
import { esId } from './entrada'
import { hoyLocal } from './fecha'

const NOMBRE = { 1: '1.er trimestre', 2: '2.º trimestre', 3: '3.er trimestre' } as const

type Preparada = { alumno: Alumno; trimestre: Trimestre; datos: Datos }

/**
 * Lo común a registrar y corregir: el alumno tiene curso activo, el contenido es válido, la fecha cae
 * en un trimestre abierto de ese curso y los objetivos marcados son de ese trimestre. El trimestre lo
 * deduce la aplicación, de modo que alumno y trimestre no pueden divergir.
 */
function preparar(db: BaseDatos, alumnoId: unknown, entrada: Partial<DatosSesion>, hoy: Fecha): Preparada | ResultadoSesion {
  const alumno = esId(alumnoId) ? obtenerAlumno(db, alumnoId) : null
  if (!alumno) return { tipo: 'rechazada', mensaje: 'Elige un alumno.' }
  const curso = cursosActivos(db).get(alumno.id)
  if (!curso) return { tipo: 'rechazada', mensaje: `${alumno.nombre} no tiene ahora un curso abierto: ábreselo desde su ficha.` }

  const datos = normalizarSesion(entrada ?? {})
  const problemas = validarSesion(datos, hoy)
  if (problemas.length > 0) return { tipo: 'invalida', problemas }

  const trimestres = trimestresDeCurso(db, curso.id)
  const ubicacion = situarFecha(trimestres, datos.fecha)
  const fuera = problemaDeUbicacion(ubicacion)
  if (fuera) return { tipo: 'invalida', problemas: [{ campo: 'fecha', mensaje: fuera }] }

  const trimestre = trimestres.find((t) => ubicacion.tipo === 'dentro' && t.numero === ubicacion.numero)!
  if (trimestre.estado === 'cerrado') {
    return { tipo: 'invalida', problemas: [{ campo: 'fecha', mensaje: `Esa fecha es del ${NOMBRE[trimestre.numero]}, que ya está cerrado.` }] }
  }

  const disponibles = new Set(repositorio.objetivosDeTrimestre(db, trimestre.id).map((o) => o.objetivoId))
  if (datos.objetivos.some((id) => !disponibles.has(id))) {
    return { tipo: 'rechazada', mensaje: `Alguno de los objetivos marcados no es del ${NOMBRE[trimestre.numero]} de este alumno.` }
  }
  return { alumno, trimestre, datos }
}

function filaDe({ alumno, trimestre, datos }: Preparada): repositorio.NuevaSesion {
  return {
    alumnoId: alumno.id,
    trimestreId: trimestre.id,
    fecha: datos.fecha,
    estadoAlumno: unirOpciones(datos.estadoAlumno),
    respuestaActividades: unirOpciones(datos.respuestaActividades),
    observaciones: datos.observaciones,
    saludMedicacion: datos.saludMedicacion,
    falta: datos.falta
  }
}

/** Una sesión solo se toca mientras su trimestre esté abierto: cerrado, respalda una valoración. */
function motivoParaNoTocar(db: BaseDatos, sesion: repositorio.SesionGuardada): string | null {
  const trimestre = obtenerTrimestre(db, sesion.trimestreId)!
  const curso = obtenerCurso(db, trimestre.cursoAcademicoId)!
  if (trimestre.estado === 'cerrado' || curso.estado === 'cerrado') {
    return `Esta sesión es del ${NOMBRE[trimestre.numero]}, que ya está cerrado: no se modifica.`
  }
  return null
}

export function registrarSesion(db: BaseDatos, alumnoId: unknown, entrada: Partial<DatosSesion>, hoy: Fecha = hoyLocal()): ResultadoSesion {
  const preparada = preparar(db, alumnoId, entrada, hoy)
  if ('tipo' in preparada) return preparada

  const id = db.transaction(() => {
    const nueva = repositorio.insertarSesion(db, filaDe(preparada))
    repositorio.asociarObjetivos(db, nueva, preparada.datos.objetivos)
    return nueva
  })()
  const { alumno, trimestre } = preparada
  return { tipo: 'registrada', sesionId: id, resumen: `${preparada.datos.falta ? 'Falta registrada' : 'Sesión registrada'}: ${alumno.nombre} ${alumno.apellidos}, ${NOMBRE[trimestre.numero]}.` }
}

/**
 * Corrige una sesión con las mismas reglas que al registrarla. Si cambia la fecha o el alumno, la
 * sesión pasa al trimestre que corresponda, siempre que esté abierto.
 */
export function corregirSesion(
  db: BaseDatos,
  sesionId: unknown,
  alumnoId: unknown,
  entrada: Partial<DatosSesion>,
  hoy: Fecha = hoyLocal()
): ResultadoSesion {
  const sesion = esId(sesionId) ? repositorio.obtenerSesion(db, sesionId) : null
  if (!sesion) return { tipo: 'rechazada', mensaje: 'Esta sesión no existe.' }
  const motivo = motivoParaNoTocar(db, sesion)
  if (motivo) return { tipo: 'rechazada', mensaje: motivo }

  const preparada = preparar(db, alumnoId, entrada, hoy)
  if ('tipo' in preparada) return preparada

  db.transaction(() => {
    repositorio.actualizarSesion(db, sesion.id, filaDe(preparada))
    repositorio.asociarObjetivos(db, sesion.id, preparada.datos.objetivos)
  })()
  const { alumno, trimestre } = preparada
  return { tipo: 'registrada', sesionId: sesion.id, resumen: `${preparada.datos.falta ? 'Falta corregida' : 'Sesión corregida'}: ${alumno.nombre} ${alumno.apellidos}, ${NOMBRE[trimestre.numero]}.` }
}

export function borrarSesion(db: BaseDatos, sesionId: unknown): { tipo: 'borrada' } | { tipo: 'rechazada'; mensaje: string } {
  const sesion = esId(sesionId) ? repositorio.obtenerSesion(db, sesionId) : null
  if (!sesion) return { tipo: 'rechazada', mensaje: 'Esta sesión no existe.' }
  const motivo = motivoParaNoTocar(db, sesion)
  if (motivo) return { tipo: 'rechazada', mensaje: motivo }
  repositorio.borrarSesion(db, sesion.id)
  return { tipo: 'borrada' }
}

const separar = (texto: string | null) => (texto ? texto.split(', ') : [])

function vista(db: BaseDatos, sesion: repositorio.SesionGuardada): VistaSesion {
  return {
    id: sesion.id,
    alumnoId: sesion.alumnoId,
    trimestreId: sesion.trimestreId,
    fecha: sesion.fecha,
    estadoAlumno: separar(sesion.estadoAlumno),
    respuestaActividades: separar(sesion.respuestaActividades),
    observaciones: sesion.observaciones,
    saludMedicacion: sesion.saludMedicacion,
    falta: sesion.falta,
    objetivos: repositorio.objetivosDeSesion(db, sesion.id),
    modificable: motivoParaNoTocar(db, sesion) === null
  }
}

export function sesionesDeCurso(db: BaseDatos, cursoId: unknown): VistaSesion[] {
  return esId(cursoId) ? repositorio.sesionesDeCurso(db, cursoId).map((s) => vista(db, s)) : []
}

export function obtenerSesion(db: BaseDatos, sesionId: unknown): VistaSesion | null {
  const sesion = esId(sesionId) ? repositorio.obtenerSesion(db, sesionId) : null
  return sesion ? vista(db, sesion) : null
}

/**
 * Los objetivos que se pueden marcar en una sesión de esa fecha: los del trimestre en el que cae,
 * el mismo que se le asignará al guardarla. Si la fecha no cae en un trimestre abierto, no hay.
 */
export function objetivosParaSesion(db: BaseDatos, alumnoId: unknown, fecha: unknown): ObjetivosParaSesion | null {
  if (!esId(alumnoId) || typeof fecha !== 'string') return null
  const curso = cursosActivos(db).get(alumnoId)
  if (!curso) return null
  const trimestres = trimestresDeCurso(db, curso.id)
  const ubicacion = situarFecha(trimestres, fecha)
  if (ubicacion.tipo !== 'dentro') return null
  const trimestre = trimestres.find((t) => t.numero === ubicacion.numero)!
  if (trimestre.estado === 'cerrado') return null
  return { trimestre: NOMBRE[trimestre.numero], objetivos: repositorio.objetivosDeTrimestre(db, trimestre.id) }
}
