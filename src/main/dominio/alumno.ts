import { esFecha } from './calendario'
import type { Fecha } from './entidades'

export type CampoAlumno = 'nombre' | 'apellidos' | 'fechaNacimiento' | 'diagnosticos' | 'notas'

/** Lo que ella escribe en el formulario. El código no está: no lo elige ella ni se puede cambiar. */
export interface DatosAlumno {
  nombre: string
  apellidos: string
  fechaNacimiento: Fecha | null
  diagnosticos: string | null
  notas: string | null
}

export interface ProblemaAlumno {
  campo: CampoAlumno
  mensaje: string
}

function texto(valor: unknown): string {
  return typeof valor === 'string' ? valor.trim() : ''
}

function opcional(valor: unknown): string | null {
  const limpio = texto(valor)
  return limpio === '' ? null : limpio
}

/** Quita espacios sobrantes y convierte los campos opcionales vacíos en "sin dato". */
export function normalizarDatosAlumno(entrada: Partial<Record<CampoAlumno, unknown>>): DatosAlumno {
  return {
    nombre: texto(entrada.nombre).replace(/\s+/g, ' '),
    apellidos: texto(entrada.apellidos).replace(/\s+/g, ' '),
    fechaNacimiento: opcional(entrada.fechaNacimiento),
    diagnosticos: opcional(entrada.diagnosticos),
    notas: opcional(entrada.notas)
  }
}

/**
 * Solo nombre y apellidos son obligatorios: dar de alta a alguien no puede detenerse pidiendo
 * datos que no tiene a mano (P3).
 */
export function validarDatosAlumno(datos: DatosAlumno, hoy: Fecha): ProblemaAlumno[] {
  const problemas: ProblemaAlumno[] = []

  if (datos.nombre === '') problemas.push({ campo: 'nombre', mensaje: 'Escribe el nombre.' })
  if (datos.apellidos === '') problemas.push({ campo: 'apellidos', mensaje: 'Escribe los apellidos.' })

  if (datos.fechaNacimiento !== null) {
    if (!esFecha(datos.fechaNacimiento)) {
      problemas.push({ campo: 'fechaNacimiento', mensaje: 'La fecha de nacimiento no es una fecha válida.' })
    } else if (datos.fechaNacimiento > hoy) {
      problemas.push({ campo: 'fechaNacimiento', mensaje: 'La fecha de nacimiento no puede ser posterior a hoy.' })
    }
  }

  return problemas
}

/** Para avisar de un posible alta repetida: mismo nombre sin distinguir mayúsculas, acentos ni espacios. */
export function claveDeNombre(nombre: string, apellidos: string): string {
  return `${nombre} ${apellidos}`
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}
