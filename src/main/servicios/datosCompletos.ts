import { componerDatosCompletos, textoLeeme } from '../dominio/datosCompletos'
import type { Fecha } from '../dominio/entidades'
import type { BaseDatos } from '../persistencia/baseDatos'
import { leerTablas } from '../persistencia/repositorioDatosCompletos'
import { versionActual } from '../persistencia/migraciones'
import { hoyLocal } from './fecha'

/**
 * T7.1: lo que acompaña a la copia de la base en la exportación completa. El JSON, con sangrías para
 * leerlo; el LÉEME, con saltos de línea de Windows para el Bloc de notas.
 */
export function exportacionCompleta(db: BaseDatos, hoy: Fecha = hoyLocal()): { json: string; leeme: string; carpeta: string } {
  const datos = componerDatosCompletos(leerTablas(db), hoy, versionActual(db))
  return {
    json: JSON.stringify(datos, null, 2) + '\n',
    leeme: textoLeeme(hoy),
    carpeta: `Ariadne - todos los datos - ${hoy}`
  }
}
