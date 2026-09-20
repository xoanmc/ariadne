import { existsSync, mkdirSync, readdirSync, statSync, unlinkSync } from 'node:fs'
import { dirname, join } from 'node:path'
import type { Copia } from '../../compartido/ipc'
import { copiarBase, type BaseDatos } from './baseDatos'

export const MAXIMO_COPIAS = 10

const PREFIJO = 'ariadne-'
const SUFIJO = '.sqlite'

export function carpetaCopias(rutaBase: string): string {
  return join(dirname(rutaBase), 'copias')
}

function marcaDeTiempo(fecha: Date): string {
  const dos = (n: number) => String(n).padStart(2, '0')
  const dia = `${fecha.getFullYear()}-${dos(fecha.getMonth() + 1)}-${dos(fecha.getDate())}`
  return `${dia}_${dos(fecha.getHours())}-${dos(fecha.getMinutes())}-${dos(fecha.getSeconds())}`
}

export function listarCopias(rutaBase: string): Copia[] {
  const carpeta = carpetaCopias(rutaBase)
  if (!existsSync(carpeta)) return []

  return readdirSync(carpeta)
    .filter((nombre) => nombre.startsWith(PREFIJO) && nombre.endsWith(SUFIJO))
    .map((nombre) => {
      const ruta = join(carpeta, nombre)
      const info = statSync(ruta)
      return { ruta, nombre, fecha: info.mtime.toISOString(), tamano: info.size }
    })
    .sort((a, b) => b.nombre.localeCompare(a.nombre))
}

export function crearCopia(db: BaseDatos, rutaBase: string, fecha = new Date()): Copia {
  const carpeta = carpetaCopias(rutaBase)
  mkdirSync(carpeta, { recursive: true })

  const marca = marcaDeTiempo(fecha)
  let destino = join(carpeta, `${PREFIJO}${marca}${SUFIJO}`)
  for (let n = 2; existsSync(destino); n++) {
    destino = join(carpeta, `${PREFIJO}${marca}-${n}${SUFIJO}`)
  }

  copiarBase(db, destino)
  const info = statSync(destino)
  return { ruta: destino, nombre: destino.slice(carpeta.length + 1), fecha: info.mtime.toISOString(), tamano: info.size }
}

export function rotarCopias(rutaBase: string, maximo = MAXIMO_COPIAS): Copia[] {
  const sobran = listarCopias(rutaBase).slice(maximo)
  sobran.forEach((copia) => unlinkSync(copia.ruta))
  return sobran
}
