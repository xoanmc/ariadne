import type { DatosSesion, ObjetivosParaSesion, ResultadoSesion } from '../../compartido/ipc'
import { situarFecha } from '../dominio/calendario'
import type { Fecha } from '../dominio/entidades'
import { normalizarSesion, problemaDeUbicacion, unirOpciones, validarSesion } from '../dominio/sesion'
import type { BaseDatos } from '../persistencia/baseDatos'
import { obtenerAlumno } from '../persistencia/repositorioAlumnos'
import { cursosActivos, trimestresDeCurso } from '../persistencia/repositorioCursos'
import { asociarObjetivos, insertarSesion, objetivosDeTrimestre } from '../persistencia/repositorioSesiones'
import { esId } from './entrada'
import { hoyLocal } from './fecha'

const NOMBRE = { 1: '1.er trimestre', 2: '2.º trimestre', 3: '3.er trimestre' } as const

/**
 * Registra una sesión. Ella elige alumno y fecha; el trimestre lo deduce la aplicación del curso
 * activo del alumno y de la fecha, de modo que alumno y trimestre no pueden divergir.
 */
export function registrarSesion(
  db: BaseDatos,
  alumnoId: unknown,
  entrada: Partial<DatosSesion>,
  hoy: Fecha = hoyLocal()
): ResultadoSesion {
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
    return {
      tipo: 'invalida',
      problemas: [{ campo: 'fecha', mensaje: `Esa fecha es del ${NOMBRE[trimestre.numero]}, que ya está cerrado.` }]
    }
  }

  const disponibles = new Set(objetivosDeTrimestre(db, trimestre.id).map((o) => o.objetivoId))
  if (datos.objetivos.some((id) => !disponibles.has(id))) {
    return { tipo: 'rechazada', mensaje: `Alguno de los objetivos marcados no es del ${NOMBRE[trimestre.numero]} de este alumno.` }
  }

  const id = db.transaction(() => {
    const nueva = insertarSesion(db, {
      alumnoId: alumno.id,
      trimestreId: trimestre.id,
      fecha: datos.fecha,
      estadoAlumno: unirOpciones(datos.estadoAlumno),
      respuestaActividades: unirOpciones(datos.respuestaActividades),
      observaciones: datos.observaciones,
      incidencias: datos.incidencias,
    saludMedicacion: datos.saludMedicacion
    })
    asociarObjetivos(db, nueva, datos.objetivos)
    return nueva
  })()
  return {
    tipo: 'registrada',
    sesionId: id,
    resumen: `Sesión registrada: ${alumno.nombre} ${alumno.apellidos}, ${NOMBRE[trimestre.numero]}.`
  }
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
  return { trimestre: NOMBRE[trimestre.numero], objetivos: objetivosDeTrimestre(db, trimestre.id) }
}
