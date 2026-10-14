import Database from 'better-sqlite3'
import { describe, expect, it } from 'vitest'
import { aplicarMigraciones } from '../../src/main/persistencia/migraciones'
import { MIGRACIONES_REALES } from '../ayudas/baseDePrueba'

const SUYAS = ["'2026-09-10', '2026-12-22'", "'2027-01-08', '2027-03-26'", "'2027-04-06', '2027-06-23'"]
const PROPUESTAS = ["'2026-09-01', '2026-12-31'", "'2027-01-01', '2027-03-31'", "'2027-04-01', '2027-06-30'"]

/** Una base de antes del calendario común: cada alumno con sus propias fechas. */
function baseAnterior(fechasPorAlumno: string[][], extra = ''): Database.Database {
  const db = new Database(':memory:')
  db.pragma('foreign_keys = ON')
  aplicarMigraciones(db, MIGRACIONES_REALES.filter((m) => m.version <= 6))
  fechasPorAlumno.forEach((fechas, i) => {
    const id = i + 1
    db.exec(`
      INSERT INTO alumno (id, codigo_interno, nombre, apellidos) VALUES (${id}, 'A-0${id}', 'Alumno${id}', 'García');
      INSERT INTO curso_academico (id, alumno_id, curso) VALUES (${id}, ${id}, '2026/2027');
      INSERT INTO trimestre (id, curso_academico_id, numero, fecha_inicio, fecha_fin) VALUES
        (${id * 10 + 1}, ${id}, 1, ${fechas[0]}), (${id * 10 + 2}, ${id}, 2, ${fechas[1]}), (${id * 10 + 3}, ${id}, 3, ${fechas[2]});
    `)
  })
  db.exec(extra)
  aplicarMigraciones(db, MIGRACIONES_REALES)
  return db
}

const calendario = (db: Database.Database) =>
  db.prepare("SELECT numero, fecha_inicio AS i, fecha_fin AS f FROM calendario_trimestre WHERE curso = '2026/2027' ORDER BY numero").all()
const primerTrimestre = (db: Database.Database, cursoId: number) =>
  db.prepare('SELECT fecha_inicio AS i, fecha_fin AS f FROM trimestre WHERE curso_academico_id = ? AND numero = 1').get(cursoId)

describe('migración 007: calendario escolar común', () => {
  it('el calendario es el juego de fechas que más se repite entre sus alumnos, y los demás se ajustan', () => {
    const db = baseAnterior([SUYAS, SUYAS, PROPUESTAS])
    expect(calendario(db)).toEqual([
      { numero: 1, i: '2026-09-10', f: '2026-12-22' },
      { numero: 2, i: '2027-01-08', f: '2027-03-26' },
      { numero: 3, i: '2027-04-06', f: '2027-06-23' }
    ])
    expect(primerTrimestre(db, 3)).toEqual({ i: '2026-09-10', f: '2026-12-22' })
  })

  it('a quien ajustarlo le dejaría una sesión fuera de su trimestre, conserva sus fechas', () => {
    const db = baseAnterior(
      [SUYAS, SUYAS, PROPUESTAS],
      "INSERT INTO sesion (alumno_id, trimestre_id, fecha, estado_alumno) VALUES (3, 31, '2026-09-02', 'Tranquilo');"
    )
    expect(primerTrimestre(db, 3)).toEqual({ i: '2026-09-01', f: '2026-12-31' })
  })

  it('a quien tiene un trimestre cerrado con otras fechas, no se le tocan', () => {
    const db = baseAnterior([SUYAS, SUYAS, PROPUESTAS], "UPDATE trimestre SET estado = 'cerrado' WHERE id = 31;")
    expect(primerTrimestre(db, 3)).toEqual({ i: '2026-09-01', f: '2026-12-31' })
  })

  it('sin cursos, no se crea ningún calendario', () => {
    expect(calendario(baseAnterior([]))).toEqual([])
  })
})
