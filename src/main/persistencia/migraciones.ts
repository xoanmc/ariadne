import type { Database } from 'better-sqlite3'

export interface Migracion {
  version: number
  nombre: string
  sql: string
}

export class ErrorMigraciones extends Error {}

const PATRON_FICHERO = /(?:^|\/)(\d+)_([a-z0-9_]+)\.sql$/

export function leerCatalogo(ficheros: Record<string, string>): Migracion[] {
  const migraciones = Object.entries(ficheros).map(([ruta, sql]) => {
    const coincidencia = PATRON_FICHERO.exec(ruta)
    if (!coincidencia) {
      throw new ErrorMigraciones(`Nombre de migración no válido: ${ruta} (se espera 001_descripcion.sql)`)
    }
    return { version: Number(coincidencia[1]), nombre: coincidencia[2], sql }
  })

  migraciones.sort((a, b) => a.version - b.version)
  migraciones.forEach((m, i) => {
    if (m.version !== i + 1) {
      throw new ErrorMigraciones(`Las migraciones deben numerarse 1, 2, 3… sin huecos ni repeticiones; falla en la versión ${m.version}`)
    }
  })
  return migraciones
}

export function crearTablaVersion(db: Database): void {
  db.exec(`CREATE TABLE IF NOT EXISTS version_esquema (
    version INTEGER PRIMARY KEY,
    nombre TEXT NOT NULL,
    aplicada_en TEXT NOT NULL
  )`)
}

export function versionActual(db: Database): number {
  const fila = db.prepare('SELECT MAX(version) AS v FROM version_esquema').get() as { v: number | null }
  return fila.v ?? 0
}

export function aplicarMigraciones(db: Database, migraciones: Migracion[]): Migracion[] {
  crearTablaVersion(db)
  const actual = versionActual(db)
  const ultimaConocida = migraciones.at(-1)?.version ?? 0

  if (actual > ultimaConocida) {
    throw new ErrorMigraciones(
      'Esta base de datos se creó con una versión más reciente de Ariadne. Actualiza la aplicación para abrirla.'
    )
  }

  const pendientes = migraciones.filter((m) => m.version > actual)
  const registrar = db.prepare('INSERT INTO version_esquema (version, nombre, aplicada_en) VALUES (?, ?, ?)')

  for (const migracion of pendientes) {
    db.transaction(() => {
      db.exec(migracion.sql)
      registrar.run(migracion.version, migracion.nombre, new Date().toISOString())
    })()
  }
  return pendientes
}
