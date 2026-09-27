import type { DatosEvaluacion, ResultadoEvaluacion, VistaEvaluacion } from '../../compartido/ipc'
import type { Fecha } from '../dominio/entidades'
import { normalizarEvaluacion, sugerenciasDeInstrumento as sugerencias, validarEvaluacion } from '../dominio/evaluacion'
import type { BaseDatos } from '../persistencia/baseDatos'
import { obtenerCurso } from '../persistencia/repositorioCursos'
import * as repositorio from '../persistencia/repositorioEvaluaciones'
import { esId } from './entrada'
import { hoyLocal } from './fecha'

export function evaluacionDeCurso(db: BaseDatos, cursoId: unknown): VistaEvaluacion | null {
  if (!esId(cursoId)) return null
  const evaluacion = repositorio.evaluacionDeCurso(db, cursoId)
  if (!evaluacion) return null
  const { id, fecha, instrumento, contenido } = evaluacion
  return { id, fecha, instrumento, contenido }
}

/** Registra la evaluación inicial del curso o corrige la que ya tiene: hay una por curso. */
export function guardarEvaluacion(
  db: BaseDatos,
  cursoId: unknown,
  entrada: Partial<DatosEvaluacion>,
  hoy: Fecha = hoyLocal()
): ResultadoEvaluacion {
  const curso = esId(cursoId) ? obtenerCurso(db, cursoId) : null
  if (!curso) return { tipo: 'rechazada', mensaje: 'Este curso no existe.' }
  if (curso.estado === 'cerrado') {
    return { tipo: 'rechazada', mensaje: `El curso ${curso.curso} está cerrado y su evaluación inicial ya no cambia.` }
  }

  const datos = normalizarEvaluacion(entrada ?? {})
  const problemas = validarEvaluacion(datos, curso.curso, hoy)
  if (problemas.length > 0) return { tipo: 'invalida', problemas }

  repositorio.guardarEvaluacion(db, curso.id, datos)
  return { tipo: 'guardada', evaluacion: evaluacionDeCurso(db, curso.id)! }
}

export function sugerenciasDeInstrumento(db: BaseDatos): string[] {
  return sugerencias(repositorio.instrumentosUsados(db))
}
