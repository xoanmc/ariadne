import Database from 'better-sqlite3'
import { describe, expect, it } from 'vitest'
import {
  aplicarMigraciones,
  ErrorMigraciones,
  leerCatalogo,
  versionActual,
  type Migracion
} from '../../src/main/persistencia/migraciones'

const M1: Migracion = { version: 1, nombre: 'alumnos', sql: 'CREATE TABLE alumno (id INTEGER PRIMARY KEY, nombre TEXT)' }
const M2: Migracion = { version: 2, nombre: 'notas', sql: 'ALTER TABLE alumno ADD COLUMN notas TEXT' }

function tablas(db: Database.Database): string[] {
  return (db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name").all() as { name: string }[]).map(
    (t) => t.name
  )
}

describe('leerCatalogo', () => {
  it('extrae versión y nombre del fichero y ordena por versión', () => {
    const catalogo = leerCatalogo({
      '../../../recursos/migraciones/002_notas.sql': 'B',
      '../../../recursos/migraciones/001_alumnos.sql': 'A'
    })
    expect(catalogo).toEqual([
      { version: 1, nombre: 'alumnos', sql: 'A' },
      { version: 2, nombre: 'notas', sql: 'B' }
    ])
  })

  it('rechaza huecos en la numeración', () => {
    expect(() => leerCatalogo({ '001_a.sql': '', '003_c.sql': '' })).toThrow(ErrorMigraciones)
  })

  it('rechaza versiones repetidas', () => {
    expect(() => leerCatalogo({ '001_a.sql': '', '01_b.sql': '' })).toThrow(ErrorMigraciones)
  })

  it('rechaza nombres que no siguen el patrón', () => {
    expect(() => leerCatalogo({ 'inicial.sql': '' })).toThrow(ErrorMigraciones)
  })

  it('acepta un catálogo vacío', () => {
    expect(leerCatalogo({})).toEqual([])
  })
})

describe('aplicarMigraciones', () => {
  it('crea la tabla de versión y aplica las pendientes en orden', () => {
    const db = new Database(':memory:')
    const aplicadas = aplicarMigraciones(db, [M1, M2])

    expect(aplicadas.map((m) => m.version)).toEqual([1, 2])
    expect(versionActual(db)).toBe(2)
    expect(tablas(db)).toEqual(['alumno', 'version_esquema'])
    db.prepare('INSERT INTO alumno (nombre, notas) VALUES (?, ?)').run('Ana', 'x')
  })

  it('no vuelve a aplicar las ya aplicadas', () => {
    const db = new Database(':memory:')
    aplicarMigraciones(db, [M1])
    expect(aplicarMigraciones(db, [M1, M2]).map((m) => m.version)).toEqual([2])
    expect(aplicarMigraciones(db, [M1, M2])).toEqual([])
  })

  it('una migración que falla no deja rastro y detiene las siguientes', () => {
    const db = new Database(':memory:')
    const rota: Migracion = { version: 2, nombre: 'rota', sql: 'CREATE TABLE a_medias (id INTEGER); SELECT * FROM no_existe' }
    const M3: Migracion = { version: 3, nombre: 'despues', sql: 'CREATE TABLE despues (id INTEGER)' }

    expect(() => aplicarMigraciones(db, [M1, rota, M3])).toThrow()
    expect(versionActual(db)).toBe(1)
    expect(tablas(db)).toEqual(['alumno', 'version_esquema'])
  })

  it('rechaza una base creada por una versión más reciente de la aplicación', () => {
    const db = new Database(':memory:')
    aplicarMigraciones(db, [M1, M2])
    expect(() => aplicarMigraciones(db, [M1])).toThrow(/versión más reciente/)
  })
})
