import Database from 'better-sqlite3'
import type { Database as BaseDatos } from 'better-sqlite3'
import { aplicarMigraciones, type Migracion } from './migraciones'

export type { BaseDatos }

export class ErrorBaseDatos extends Error {}

function configurar(db: BaseDatos): void {
  db.pragma('foreign_keys = ON')
  // Sin WAL: la base debe ser un único fichero que se pueda copiar o llevar en un USB (P1, P2).
  db.pragma('journal_mode = DELETE')
}

export function crearBase(ruta: string, migraciones: Migracion[]): BaseDatos {
  const db = new Database(ruta)
  try {
    configurar(db)
    aplicarMigraciones(db, migraciones)
    return db
  } catch (error) {
    db.close()
    throw error
  }
}

export function abrirBaseExistente(ruta: string, migraciones: Migracion[]): BaseDatos {
  const db = new Database(ruta, { fileMustExist: true })
  try {
    let esDeAriadne: boolean
    try {
      esDeAriadne = db
        .prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'version_esquema'")
        .get() !== undefined
    } catch {
      esDeAriadne = false
    }
    if (!esDeAriadne) {
      throw new ErrorBaseDatos('El fichero elegido no es una base de datos de Ariadne.')
    }
    configurar(db)
    aplicarMigraciones(db, migraciones)
    return db
  } catch (error) {
    db.close()
    throw error
  }
}

export function copiarBase(db: BaseDatos, destino: string): void {
  db.prepare('VACUUM INTO ?').run(destino)
}
