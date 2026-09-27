import type { DatosActa, ResultadoActa, VistaActa } from '../../compartido/ipc'
import { normalizarActa, validarActa } from '../dominio/acta'
import type { ActaReunion, CursoAcademico, Fecha } from '../dominio/entidades'
import type { BaseDatos } from '../persistencia/baseDatos'
import * as repositorio from '../persistencia/repositorioActas'
import { obtenerCurso } from '../persistencia/repositorioCursos'
import { esId } from './entrada'
import { hoyLocal } from './fecha'

function vista(acta: ActaReunion): VistaActa {
  const { id, fecha, asistentes, contenido, acuerdos } = acta
  return { id, fecha, asistentes, contenido, acuerdos }
}

function motivoDeRechazo(curso: CursoAcademico | null): string | null {
  if (!curso) return 'Este curso no existe.'
  if (curso.estado === 'cerrado') return `El curso ${curso.curso} está cerrado y sus actas ya no cambian.`
  return null
}

export function actasDeCurso(db: BaseDatos, cursoId: unknown): VistaActa[] {
  return esId(cursoId) ? repositorio.actasDeCurso(db, cursoId).map(vista) : []
}

export function registrarActa(
  db: BaseDatos,
  cursoId: unknown,
  entrada: Partial<DatosActa>,
  hoy: Fecha = hoyLocal()
): ResultadoActa {
  const curso = esId(cursoId) ? obtenerCurso(db, cursoId) : null
  const rechazo = motivoDeRechazo(curso)
  if (rechazo) return { tipo: 'rechazada', mensaje: rechazo }

  const datos = normalizarActa(entrada ?? {})
  const problemas = validarActa(datos, curso!.curso, hoy)
  if (problemas.length > 0) return { tipo: 'invalida', problemas }

  const id = repositorio.insertarActa(db, curso!.id, datos)
  return { tipo: 'guardada', acta: vista(repositorio.obtenerActa(db, id)!) }
}

export function corregirActa(
  db: BaseDatos,
  actaId: unknown,
  entrada: Partial<DatosActa>,
  hoy: Fecha = hoyLocal()
): ResultadoActa {
  const acta = esId(actaId) ? repositorio.obtenerActa(db, actaId) : null
  if (!acta) return { tipo: 'rechazada', mensaje: 'Esta acta no existe.' }

  const curso = obtenerCurso(db, acta.cursoAcademicoId)
  const rechazo = motivoDeRechazo(curso)
  if (rechazo) return { tipo: 'rechazada', mensaje: rechazo }

  const datos = normalizarActa(entrada ?? {})
  const problemas = validarActa(datos, curso!.curso, hoy)
  if (problemas.length > 0) return { tipo: 'invalida', problemas }

  repositorio.actualizarActa(db, acta.id, datos)
  return { tipo: 'guardada', acta: vista(repositorio.obtenerActa(db, acta.id)!) }
}
