import Database from 'better-sqlite3'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { aplicarMigraciones, leerCatalogo, type Migracion } from '../../src/main/persistencia/migraciones'

const CARPETA = fileURLToPath(new URL('../../recursos/migraciones', import.meta.url))

/** Las migraciones reales del proyecto, leídas de disco: las pruebas prueban lo que se va a publicar. */
export const MIGRACIONES_REALES: Migracion[] = leerCatalogo(
  Object.fromEntries(
    readdirSync(CARPETA)
      .filter((f) => f.endsWith('.sql'))
      .map((f) => [f, readFileSync(join(CARPETA, f), 'utf8')])
  )
)

/** Base en memoria con el esquema completo y las claves ajenas activas, como la usa la aplicación. */
export function crearBaseDePrueba(): Database.Database {
  const db = new Database(':memory:')
  db.pragma('foreign_keys = ON')
  aplicarMigraciones(db, MIGRACIONES_REALES)
  return db
}
