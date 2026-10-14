import type { ResultadoCalendario, VistaCalendario } from '../../compartido/ipc'
import { fueraDeSuTrimestre, NOMBRE_TRIMESTRE, type PeriodoTrimestre } from '../dominio/calendario'
import { cursoDeFecha, extremosDeCurso, fechasPropuestas, validarCurso } from '../dominio/curso'
import type { Fecha, NumeroTrimestre } from '../dominio/entidades'
import type { BaseDatos } from '../persistencia/baseDatos'
import * as repositorio from '../persistencia/repositorioCalendario'
import { actualizarFechasTrimestre } from '../persistencia/repositorioCursos'
import { hoyLocal } from './fecha'

/**
 * El calendario de un curso escolar: las fechas de sus tres trimestres, comunes a todos los alumnos.
 * Cada alumno guarda una copia en sus trimestres, que es la que usan las demás partes; este servicio
 * es el único que la escribe, y la mantiene igual al calendario siempre que no descoloque nada.
 */

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

const mismas = (a: { fechaInicio: string; fechaFin: string }, b: { fechaInicio: string; fechaFin: string }) =>
  a.fechaInicio === b.fechaInicio && a.fechaFin === b.fechaFin

/** Las fechas de ese curso escolar. Si todavía no tiene calendario, se fija con las propuestas, que ella corrige. */
export function asegurarCalendario(db: BaseDatos, curso: string): PeriodoTrimestre[] {
  const existente = repositorio.calendarioDe(db, curso)
  if (existente) return existente
  const propuestas = fechasPropuestas(curso)
  repositorio.guardarPeriodos(db, curso, propuestas)
  return propuestas
}

interface Plan {
  /** Cursos de alumno que pasan a las fechas nuevas. */
  ajustar: { cursoAcademicoId: number; trimestres: repositorio.TrimestreDeAlumno[] }[]
  /** Lo que impide guardar: un cambio que descolocaría a un alumno que seguía el calendario. */
  impedimentos: string[]
  /** Alumnos que conservan otras fechas, y por qué. */
  conFechasPropias: { alumno: string; motivo: string }[]
}

const sesiones = (n: number) => (n === 1 ? 'una sesión' : `${n} sesiones`)

/**
 * Qué pasaría con cada alumno si el calendario fuera `periodos`. Quien seguía el calendario anterior
 * tiene que poder seguir el nuevo, o no se guarda; quien ya tenía otras fechas se ajusta si puede.
 */
function planificar(db: BaseDatos, curso: string, periodos: readonly PeriodoTrimestre[], anterior: readonly PeriodoTrimestre[] | null): Plan {
  const porCurso = new Map<number, repositorio.TrimestreDeAlumno[]>()
  for (const t of repositorio.trimestresDelCursoEscolar(db, curso)) {
    porCurso.set(t.cursoAcademicoId, [...(porCurso.get(t.cursoAcademicoId) ?? []), t])
  }
  const todasLasSesiones = repositorio.sesionesDelCursoEscolar(db, curso)
  const plan: Plan = { ajustar: [], impedimentos: [], conFechasPropias: [] }

  for (const [cursoAcademicoId, trimestres] of porCurso) {
    const alumno = trimestres[0].alumno
    const periodoDe = (numero: NumeroTrimestre, de: readonly PeriodoTrimestre[]) => de.find((p) => p.numero === numero)!
    const loSeguia = anterior !== null && trimestres.every((t) => mismas(t, periodoDe(t.numero, anterior)))
    if (trimestres.every((t) => mismas(t, periodoDe(t.numero, periodos)))) continue

    const cerrado = trimestres.find((t) => t.estado === 'cerrado' && !mismas(t, periodoDe(t.numero, periodos)))
    const fuera = fueraDeSuTrimestre(periodos, todasLasSesiones.filter((s) => s.cursoAcademicoId === cursoAcademicoId))

    if (cerrado) {
      const nombre = NOMBRE_TRIMESTRE[cerrado.numero]
      if (loSeguia) plan.impedimentos.push(`El ${nombre} ya está cerrado para ${alumno}: sus fechas ya no cambian.`)
      else plan.conFechasPropias.push({ alumno, motivo: `Tiene cerrado el ${nombre} con otras fechas.` })
    } else if (fuera.length > 0) {
      if (loSeguia) plan.impedimentos.push(`${alumno} tiene ${sesiones(fuera.length)} que quedaría${fuera.length === 1 ? '' : 'n'} fuera de su trimestre.`)
      else plan.conFechasPropias.push({ alumno, motivo: `Con estas fechas, ${sesiones(fuera.length)} quedaría${fuera.length === 1 ? '' : 'n'} fuera de su trimestre.` })
    } else {
      plan.ajustar.push({ cursoAcademicoId, trimestres })
    }
  }
  return plan
}

function vista(db: BaseDatos, curso: string): VistaCalendario {
  const guardado = repositorio.calendarioDe(db, curso)
  const periodos = guardado ?? fechasPropuestas(curso)
  const trimestres = repositorio.trimestresDelCursoEscolar(db, curso)
  const plan = planificar(db, curso, periodos, null)
  const sigue = (t: repositorio.TrimestreDeAlumno) => mismas(t, periodos.find((p) => p.numero === t.numero)!)
  return {
    curso,
    periodos,
    fijado: guardado !== null,
    alumnos: new Set(trimestres.map((t) => t.cursoAcademicoId)).size,
    // Un trimestre cerrado para alguien que sigue el calendario ya no cambia de fechas
    cerrados: ([1, 2, 3] as NumeroTrimestre[]).filter((n) =>
      trimestres.some((t) => t.numero === n && t.estado === 'cerrado' && sigue(t))
    ),
    conFechasPropias: plan.conFechasPropias,
    pendientesDeAjustar: plan.ajustar.length
  }
}

/** El del curso que toca por la fecha, aunque aún no esté fijado, y los demás que ya existen. */
export function listarCalendarios(db: BaseDatos, hoy: Fecha = hoyLocal()): VistaCalendario[] {
  const cursos = new Set([cursoDeFecha(hoy), ...repositorio.cursosConCalendario(db)])
  return [...cursos].sort().reverse().map((curso) => vista(db, curso))
}

/**
 * Guarda las fechas de un curso escolar y las aplica a todos sus alumnos en una sola transacción.
 * Guardar sin cambios vuelve a intentar ajustar a quien tenía fechas propias.
 */
export function guardarCalendario(db: BaseDatos, curso: unknown, entrada: unknown): ResultadoCalendario {
  const nombre = typeof curso === 'string' ? curso.trim() : ''
  if (!extremosDeCurso(nombre)) return { tipo: 'rechazado', mensaje: 'Ese curso escolar no es válido.' }

  const periodos = periodosDe(entrada)
  const problemas = validarCurso(nombre, periodos)
  if (problemas.length > 0) return { tipo: 'invalido', problemas }

  const plan = planificar(db, nombre, periodos, repositorio.calendarioDe(db, nombre))
  if (plan.impedimentos.length > 0) return { tipo: 'rechazado', mensaje: `No se puede guardar. ${plan.impedimentos.join(' ')}` }

  db.transaction(() => {
    repositorio.guardarPeriodos(db, nombre, periodos)
    for (const { trimestres } of plan.ajustar) {
      for (const t of trimestres) actualizarFechasTrimestre(db, t.trimestreId, periodos.find((p) => p.numero === t.numero)!)
    }
  })()
  return { tipo: 'guardado', calendario: vista(db, nombre) }
}
