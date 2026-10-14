import type Database from 'better-sqlite3'
import type { PeriodoTrimestre, ResultadoCurso } from '../../src/compartido/ipc'
import { guardarCalendario } from '../../src/main/servicios/calendario'
import { abrirCurso } from '../../src/main/servicios/cursos'

/**
 * Abre un curso con unas fechas concretas: como las fechas son del calendario escolar, primero fija
 * ese calendario y después abre el curso, que las toma de él.
 */
export function abrirCursoDePrueba(
  db: Database.Database,
  alumnoId: number,
  entrada: { curso: string; nivelEducativo: string | null; periodos?: PeriodoTrimestre[] }
): ResultadoCurso {
  if (entrada.periodos) {
    const calendario = guardarCalendario(db, entrada.curso, entrada.periodos)
    if (calendario.tipo !== 'guardado') throw new Error(`calendario fallido: ${JSON.stringify(calendario)}`)
  }
  return abrirCurso(db, alumnoId, { curso: entrada.curso, nivelEducativo: entrada.nivelEducativo })
}
