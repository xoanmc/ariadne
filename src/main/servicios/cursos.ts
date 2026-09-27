import type { DatosCurso, PropuestaCurso, ResultadoCurso, VistaCurso } from '../../compartido/ipc'
import type { PeriodoTrimestre } from '../dominio/calendario'
import { cursoDeFecha, esPosteriorATodos, extremosDeCurso, fechasPropuestas, validarCurso } from '../dominio/curso'
import type { CursoAcademico, Fecha, NumeroTrimestre } from '../dominio/entidades'
import type { BaseDatos } from '../persistencia/baseDatos'
import { obtenerAlumno } from '../persistencia/repositorioAlumnos'
import * as repositorio from '../persistencia/repositorioCursos'
import { esId, textoOpcional } from './entrada'
import { hoyLocal } from './fecha'

function vista(db: BaseDatos, curso: CursoAcademico): VistaCurso {
  const anterior = curso.cursoAnteriorId === null ? null : repositorio.obtenerCurso(db, curso.cursoAnteriorId)
  return {
    id: curso.id,
    alumnoId: curso.alumnoId,
    curso: curso.curso,
    nivelEducativo: curso.nivelEducativo,
    estado: curso.estado,
    cursoAnterior: anterior?.curso ?? null,
    trimestres: repositorio.trimestresDeCurso(db, curso.id).map((t) => ({
      id: t.id,
      numero: t.numero,
      fechaInicio: t.fechaInicio,
      fechaFin: t.fechaFin,
      estado: t.estado
    }))
  }
}

function periodosDe(valor: unknown): PeriodoTrimestre[] {
  if (!Array.isArray(valor)) return []
  return valor
    .filter((p) => p && [1, 2, 3].includes(p.numero))
    .map((p) => ({
      numero: p.numero as NumeroTrimestre,
      fechaInicio: typeof p.fechaInicio === 'string' ? p.fechaInicio.trim() : '',
      fechaFin: typeof p.fechaFin === 'string' ? p.fechaFin.trim() : ''
    }))
}

function normalizar(entrada: Partial<DatosCurso> | null | undefined) {
  return {
    curso: typeof entrada?.curso === 'string' ? entrada.curso.trim() : '',
    nivelEducativo: textoOpcional(entrada?.nivelEducativo),
    periodos: periodosDe(entrada?.periodos)
  }
}

function siguienteA(curso: string): string {
  const [, fin] = extremosDeCurso(curso)!
  return `${fin}/${fin + 1}`
}

export function obtenerCurso(db: BaseDatos, cursoId: unknown): VistaCurso | null {
  const curso = esId(cursoId) ? repositorio.obtenerCurso(db, cursoId) : null
  return curso ? vista(db, curso) : null
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

  return { tipo: 'propuesta', curso, periodos: fechasPropuestas(curso), cursoAnterior: ultimo }
}

export function abrirCurso(db: BaseDatos, alumnoId: unknown, entrada: Partial<DatosCurso>): ResultadoCurso {
  if (!esId(alumnoId) || !obtenerAlumno(db, alumnoId)) return { tipo: 'rechazado', mensaje: 'Este alumno no existe.' }

  const datos = normalizar(entrada)
  const problemas = validarCurso(datos.curso, datos.periodos)
  if (problemas.length > 0) return { tipo: 'invalido', problemas }

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
    datos.periodos.forEach((periodo) => repositorio.insertarTrimestre(db, nuevo, periodo))
    return nuevo
  })()

  return { tipo: 'guardado', curso: vista(db, repositorio.obtenerCurso(db, id)!) }
}

/**
 * Corrige el nivel y las fechas de un curso activo. El curso en sí no cambia, un trimestre cerrado
 * conserva sus fechas y un curso cerrado ya no se modifica: se consulta.
 */
export function corregirCurso(db: BaseDatos, cursoId: unknown, entrada: Partial<DatosCurso>): ResultadoCurso {
  const curso = esId(cursoId) ? repositorio.obtenerCurso(db, cursoId) : null
  if (!curso) return { tipo: 'rechazado', mensaje: 'Este curso no existe.' }
  if (curso.estado === 'cerrado') {
    return { tipo: 'rechazado', mensaje: `El curso ${curso.curso} está cerrado y ya no se modifica.` }
  }

  const datos = normalizar(entrada)
  const problemas = validarCurso(curso.curso, datos.periodos)
  if (problemas.length > 0) return { tipo: 'invalido', problemas }

  const trimestres = repositorio.trimestresDeCurso(db, curso.id)
  for (const trimestre of trimestres) {
    const nuevo = datos.periodos.find((p) => p.numero === trimestre.numero)!
    const cambia = nuevo.fechaInicio !== trimestre.fechaInicio || nuevo.fechaFin !== trimestre.fechaFin
    if (trimestre.estado === 'cerrado' && cambia) {
      return {
        tipo: 'rechazado',
        mensaje: `El trimestre ${trimestre.numero} está cerrado y sus fechas ya no cambian.`
      }
    }
  }

  db.transaction(() => {
    repositorio.actualizarNivelEducativo(db, curso.id, datos.nivelEducativo)
    for (const trimestre of trimestres) {
      repositorio.actualizarFechasTrimestre(db, trimestre.id, datos.periodos.find((p) => p.numero === trimestre.numero)!)
    }
  })()

  return { tipo: 'guardado', curso: vista(db, repositorio.obtenerCurso(db, curso.id)!) }
}
