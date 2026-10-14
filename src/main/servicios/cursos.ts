import type { DatosCurso, PropuestaCurso, ResultadoCurso, VistaCurso } from '../../compartido/ipc'
import { trimestreEnCurso } from '../dominio/calendario'
import { trimestreACerrar } from '../dominio/cierre'
import { cursoDeFecha, esPosteriorATodos, extremosDeCurso, fechasPropuestas } from '../dominio/curso'
import type { CursoAcademico, Fecha } from '../dominio/entidades'
import type { BaseDatos } from '../persistencia/baseDatos'
import { obtenerAlumno } from '../persistencia/repositorioAlumnos'
import { calendarioDe } from '../persistencia/repositorioCalendario'
import * as repositorio from '../persistencia/repositorioCursos'
import { asegurarCalendario } from './calendario'
import { esId, textoOpcional } from './entrada'
import { hoyLocal } from './fecha'

function vista(db: BaseDatos, curso: CursoAcademico, hoy: Fecha = hoyLocal()): VistaCurso {
  const anterior = curso.cursoAnteriorId === null ? null : repositorio.obtenerCurso(db, curso.cursoAnteriorId)
  const trimestres = repositorio.trimestresDeCurso(db, curso.id)
  return {
    id: curso.id,
    alumnoId: curso.alumnoId,
    curso: curso.curso,
    nivelEducativo: curso.nivelEducativo,
    estado: curso.estado,
    cursoAnterior: anterior?.curso ?? null,
    trimestres: trimestres.map((t) => ({
      id: t.id,
      numero: t.numero,
      fechaInicio: t.fechaInicio,
      fechaFin: t.fechaFin,
      estado: t.estado
    })),
    trimestreEnCursoId: trimestreEnCurso(trimestres, hoy)?.id ?? null,
    trimestreACerrarId: curso.estado === 'activo' ? (trimestreACerrar(trimestres)?.id ?? null) : null
  }
}

function normalizar(entrada: Partial<DatosCurso> | null | undefined) {
  return {
    curso: typeof entrada?.curso === 'string' ? entrada.curso.trim() : '',
    nivelEducativo: textoOpcional(entrada?.nivelEducativo)
  }
}

function siguienteA(curso: string): string {
  const [, fin] = extremosDeCurso(curso)!
  return `${fin}/${fin + 1}`
}

export function obtenerCurso(db: BaseDatos, cursoId: unknown, hoy: Fecha = hoyLocal()): VistaCurso | null {
  const curso = esId(cursoId) ? repositorio.obtenerCurso(db, cursoId) : null
  return curso ? vista(db, curso, hoy) : null
}

/** Del más reciente al más antiguo. */
export function cursosDeAlumno(db: BaseDatos, alumnoId: unknown): VistaCurso[] {
  if (!esId(alumnoId)) return []
  return repositorio.cursosDeAlumno(db, alumnoId).map((c) => vista(db, c))
}

/**
 * Propone el curso que toca por la fecha o, si ese ya existe, el siguiente al último que tiene.
 * Si pide un curso concreto, propone las fechas de ese curso.
 */
export function proponerCurso(db: BaseDatos, alumnoId: unknown, pedido?: unknown, hoy: Fecha = hoyLocal()): PropuestaCurso {
  if (!esId(alumnoId) || !obtenerAlumno(db, alumnoId)) return { tipo: 'no_existe' }

  const cursos = repositorio.cursosDeAlumno(db, alumnoId)
  const activo = cursos.find((c) => c.estado === 'activo')
  if (activo) return { tipo: 'curso_activo', curso: activo.curso }

  const ultimo = cursos[0]?.curso ?? null
  let curso = cursoDeFecha(hoy)
  if (ultimo && curso <= ultimo) curso = siguienteA(ultimo)
  if (typeof pedido === 'string' && extremosDeCurso(pedido.trim())) curso = pedido.trim()

  const calendario = calendarioDe(db, curso)
  return { tipo: 'propuesta', curso, periodos: calendario ?? fechasPropuestas(curso), calendarioFijado: calendario !== null, cursoAnterior: ultimo }
}

export function abrirCurso(db: BaseDatos, alumnoId: unknown, entrada: Partial<DatosCurso>): ResultadoCurso {
  if (!esId(alumnoId) || !obtenerAlumno(db, alumnoId)) return { tipo: 'rechazado', mensaje: 'Este alumno no existe.' }

  const datos = normalizar(entrada)
  if (!extremosDeCurso(datos.curso)) {
    return { tipo: 'invalido', problemas: [{ campo: 'curso', mensaje: 'Escribe el curso con sus dos años seguidos, por ejemplo 2026/2027.' }] }
  }

  const cursos = repositorio.cursosDeAlumno(db, alumnoId)
  const activo = cursos.find((c) => c.estado === 'activo')
  if (activo) {
    return {
      tipo: 'rechazado',
      mensaje: `Este alumno tiene abierto el curso ${activo.curso}. Para abrir otro, cierra antes su tercer trimestre.`
    }
  }
  if (cursos.some((c) => c.curso === datos.curso)) {
    return { tipo: 'rechazado', mensaje: `El curso ${datos.curso} ya existe para este alumno.` }
  }
  if (!esPosteriorATodos(datos.curso, cursos.map((c) => c.curso))) {
    return {
      tipo: 'rechazado',
      mensaje: `Solo se puede abrir un curso posterior al último que tiene, ${cursos[0].curso}.`
    }
  }

  const id = db.transaction(() => {
    const nuevo = repositorio.insertarCurso(db, {
      alumnoId,
      curso: datos.curso,
      nivelEducativo: datos.nivelEducativo,
      cursoAnteriorId: cursos[0]?.id ?? null
    })
    // Las fechas son las del calendario de ese curso escolar, el mismo para todos sus alumnos
    asegurarCalendario(db, datos.curso).forEach((periodo) => repositorio.insertarTrimestre(db, nuevo, periodo))
    return nuevo
  })()

  return { tipo: 'guardado', curso: vista(db, repositorio.obtenerCurso(db, id)!) }
}

/**
 * Corrige el nivel educativo de un curso activo. El curso en sí no cambia, las fechas son las del
 * calendario escolar, y un curso cerrado ya no se modifica: se consulta.
 */
export function corregirCurso(db: BaseDatos, cursoId: unknown, entrada: Partial<Pick<DatosCurso, 'nivelEducativo'>>): ResultadoCurso {
  const curso = esId(cursoId) ? repositorio.obtenerCurso(db, cursoId) : null
  if (!curso) return { tipo: 'rechazado', mensaje: 'Este curso no existe.' }
  if (curso.estado === 'cerrado') {
    return { tipo: 'rechazado', mensaje: `El curso ${curso.curso} está cerrado y ya no se modifica.` }
  }
  repositorio.actualizarNivelEducativo(db, curso.id, textoOpcional(entrada?.nivelEducativo))
  return { tipo: 'guardado', curso: vista(db, repositorio.obtenerCurso(db, curso.id)!) }
}
