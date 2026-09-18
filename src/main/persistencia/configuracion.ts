import { existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs'

export interface Configuracion {
  rutaBaseDatos: string
}

export class ErrorConfiguracion extends Error {}

export function leerConfiguracion(ruta: string): Configuracion | null {
  if (!existsSync(ruta)) return null
  try {
    const datos = JSON.parse(readFileSync(ruta, 'utf8')) as Partial<Configuracion>
    if (typeof datos.rutaBaseDatos !== 'string' || datos.rutaBaseDatos === '') {
      throw new Error('falta rutaBaseDatos')
    }
    return { rutaBaseDatos: datos.rutaBaseDatos }
  } catch (error) {
    throw new ErrorConfiguracion(
      `No se pudo leer la configuración de Ariadne (${ruta}): ${error instanceof Error ? error.message : error}`
    )
  }
}

export function guardarConfiguracion(ruta: string, configuracion: Configuracion): void {
  const temporal = `${ruta}.tmp`
  writeFileSync(temporal, JSON.stringify(configuracion, null, 2), 'utf8')
  renameSync(temporal, ruta)
}
