import { situarFecha } from '../dominio/calendario'
import { cursoDeFecha } from '../dominio/curso'
import { componerExportacion, nombreDeFichero, trimestreParaExportar } from '../dominio/exportacion'
import type { Fecha, NumeroTrimestre } from '../dominio/entidades'
import type { BaseDatos } from '../persistencia/baseDatos'
import { obtenerAlumno } from '../persistencia/repositorioAlumnos'
import { calendarioDe } from '../persistencia/repositorioCalendario'
import { cursosActivos, obtenerCurso, obtenerTrimestre, trimestresDeCurso } from '../persistencia/repositorioCursos'
import { estancadoDe, verificacionDeTrimestre } from './cierre'
import { esId } from './entrada'
import { hoyLocal } from './fecha'
import { sesionesDeCurso } from './sesiones'

/**
 * T6.1 (RF-29): el fichero del trimestre de un alumno, con el nombre que se le propone al guardarlo.
 * Se puede exportar en cualquier momento; si el trimestre sigue abierto, el fichero lo dice.
 */
export function exportacionDeTrimestre(db: BaseDatos, trimestreId: unknown, hoy: Fecha = hoyLocal()): { nombreFichero: string; texto: string } | null {
  const trimestre = esId(trimestreId) ? obtenerTrimestre(db, trimestreId) : null
  if (!trimestre) return null
  const curso = obtenerCurso(db, trimestre.cursoAcademicoId)!
  const alumno = obtenerAlumno(db, curso.alumnoId)!
  const verificacion = verificacionDeTrimestre(db, trimestre.id)!

  const datos = {
    alumno: { nombre: alumno.nombre, apellidos: alumno.apellidos, codigo: alumno.codigoInterno },
    curso: curso.curso,
    nivelEducativo: curso.nivelEducativo,
    trimestre: {
      numero: trimestre.numero,
      fechaInicio: trimestre.fechaInicio,
      fechaFin: trimestre.fechaFin,
      cerrado: trimestre.estado === 'cerrado' || curso.estado === 'cerrado'
    },
    hoy,
    objetivos: verificacion.objetivos.map((o) => ({
      enunciado: o.enunciado,
      valoracion: o.etiquetaValoracion,
      comentario: o.comentario,
      sesiones: o.sesiones,
      arrastrado: o.arrastrado,
      estancado: estancadoDe(db, o.asignacionId)
    })),
    sesiones: sesionesDeCurso(db, curso.id)
      .filter((s) => s.trimestreId === trimestre.id)
      .map((s) => ({
        fecha: s.fecha,
        falta: s.falta,
        estadoAlumno: s.estadoAlumno,
        respuestaActividades: s.respuestaActividades,
        objetivos: s.objetivos.map((o) => o.enunciado),
        observaciones: s.observaciones,
        saludMedicacion: s.saludMedicacion
      }))
  }
  return { nombreFichero: nombreDeFichero(datos), texto: componerExportacion(datos) }
}

/** Para el botón de exportar a todos: cuántos alumnos tienen curso activo y qué trimestre se propone. */
export function resumenParaExportarTodos(db: BaseDatos, hoy: Fecha = hoyLocal()): { alumnos: number; trimestre: NumeroTrimestre } {
  const calendario = calendarioDe(db, cursoDeFecha(hoy))
  return {
    alumnos: cursosActivos(db).size,
    trimestre: calendario ? trimestreParaExportar(situarFecha(calendario, hoy)) : 1
  }
}

/**
 * T6.2 (RF-29): un fichero por cada alumno con curso activo, del trimestre con ese número de su curso.
 * Ordenados por apellidos, como la lista de alumnos.
 */
export function exportacionesDeTodos(db: BaseDatos, numero: unknown, hoy: Fecha = hoyLocal()): { nombreFichero: string; texto: string }[] {
  if (numero !== 1 && numero !== 2 && numero !== 3) return []
  return [...cursosActivos(db).values()]
    .map((curso) => ({ curso, alumno: obtenerAlumno(db, curso.alumnoId)! }))
    .sort((a, b) => `${a.alumno.apellidos} ${a.alumno.nombre}`.localeCompare(`${b.alumno.apellidos} ${b.alumno.nombre}`, 'es'))
    .map(({ curso }) => trimestresDeCurso(db, curso.id).find((t) => t.numero === numero)!)
    .map((t) => exportacionDeTrimestre(db, t.id, hoy)!)
}
