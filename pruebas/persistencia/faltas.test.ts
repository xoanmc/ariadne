import Database from 'better-sqlite3'
import { beforeEach, describe, expect, it } from 'vitest'
import { aplicarMigraciones } from '../../src/main/persistencia/migraciones'
import { MIGRACIONES_REALES } from '../ayudas/baseDePrueba'

/** Una base de antes de T4.6: con sesiones ya registradas, alguna con incidencias. */
function baseAnterior(): Database.Database {
  const db = new Database(':memory:')
  db.pragma('foreign_keys = ON')
  aplicarMigraciones(db, MIGRACIONES_REALES.filter((m) => m.version <= 5))
  db.exec(`
    INSERT INTO alumno (id, nombre, apellidos, codigo_interno) VALUES (1, 'Lucía', 'García', 'A-01');
    INSERT INTO curso_academico (id, alumno_id, curso, estado) VALUES (1, 1, '2026/2027', 'activo');
    INSERT INTO trimestre (id, curso_academico_id, numero, fecha_inicio, fecha_fin, estado) VALUES (1, 1, 1, '2026-09-10', '2026-12-22', 'abierto');
    INSERT INTO sesion (id, alumno_id, trimestre_id, fecha, estado_alumno, observaciones, incidencias) VALUES
      (1, 1, 1, '2026-10-05', 'Tranquilo', 'Trabajó bien', 'Llegó tarde'),
      (2, 1, 1, '2026-10-06', 'Cansado', NULL, 'Se cayó en el patio'),
      (3, 1, 1, '2026-10-07', 'Inquieto', 'Sin novedad', NULL);
  `)
  return db
}

describe('migración 006: sin incidencias y con faltas', () => {
  let db: Database.Database
  beforeEach(() => {
    db = baseAnterior()
    aplicarMigraciones(db, MIGRACIONES_REALES)
  })

  it('lo escrito en incidencias pasa a las observaciones, sin perder nada', () => {
    expect(db.prepare('SELECT id, observaciones FROM sesion ORDER BY id').all()).toEqual([
      { id: 1, observaciones: 'Trabajó bien\n\nIncidencias: Llegó tarde' },
      { id: 2, observaciones: 'Incidencias: Se cayó en el patio' },
      { id: 3, observaciones: 'Sin novedad' }
    ])
  })

  it('el campo de incidencias desaparece y las sesiones anteriores no son faltas', () => {
    const columnas = (db.prepare('PRAGMA table_info(sesion)').all() as { name: string }[]).map((c) => c.name)
    expect(columnas).not.toContain('incidencias')
    expect(db.prepare('SELECT DISTINCT falta FROM sesion').all()).toEqual([{ falta: 0 }])
  })

  it('una falta no puede llevar estado, respuesta ni salud', () => {
    const falta = (campo: string) =>
      db.prepare(`INSERT INTO sesion (alumno_id, trimestre_id, fecha, falta, ${campo}) VALUES (1, 1, '2026-10-08', 1, 'algo')`).run()
    for (const campo of ['estado_alumno', 'respuesta_actividades', 'salud_medicacion']) expect(() => falta(campo)).toThrow(/CHECK/)
    expect(() => falta('observaciones')).not.toThrow()
  })

  it('una falta no puede tener objetivos trabajados, ni al registrarla ni al corregirla', () => {
    db.exec(`
      INSERT INTO programa_intervencion (id, curso_academico_id, fecha_creacion, fecha_revision) VALUES (1, 1, '2026-09-20', '2026-09-20');
      INSERT INTO objetivo (id, programa_id, enunciado, fecha_creacion) VALUES (1, 1, 'Leer con fluidez', '2026-09-20');
      INSERT INTO sesion (id, alumno_id, trimestre_id, fecha, falta) VALUES (9, 1, 1, '2026-10-08', 1);
      INSERT INTO sesion_objetivo (sesion_id, objetivo_id) VALUES (3, 1);
    `)
    expect(() => db.prepare('INSERT INTO sesion_objetivo (sesion_id, objetivo_id) VALUES (9, 1)').run()).toThrow(/falta no tiene objetivos/)
    expect(() => db.prepare("UPDATE sesion SET falta = 1, estado_alumno = NULL WHERE id = 3").run()).toThrow(/falta no tiene objetivos/)
  })
})
