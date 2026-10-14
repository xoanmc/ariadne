import { NOMBRE_TRIMESTRE } from './calendario'
import type { Fecha, NumeroTrimestre } from './entidades'

/**
 * El fichero del trimestre (T6.1): todo lo que ella registró de un alumno en un trimestre, en texto
 * plano para leerlo sin la aplicación. Es una proyección sobre los datos (P7): nada se guarda pensando
 * en este formato. Es su archivo personal y lleva el nombre del alumno (P6).
 */
export interface DatosExportacion {
  alumno: { nombre: string; apellidos: string; codigo: string }
  curso: string
  nivelEducativo: string | null
  trimestre: { numero: NumeroTrimestre; fechaInicio: Fecha; fechaFin: Fecha; cerrado: boolean }
  /** El día en que se exporta. */
  hoy: Fecha
  objetivos: {
    enunciado: string
    valoracion: string
    comentario: string | null
    sesiones: number
    arrastrado: boolean
    /** Trimestres seguidos pendiente de desarrollar, si son dos o más. */
    estancado: number | null
  }[]
  /** En orden cronológico. */
  sesiones: {
    fecha: Fecha
    falta: boolean
    estadoAlumno: string[]
    respuestaActividades: string[]
    objetivos: string[]
    observaciones: string | null
    saludMedicacion: string | null
  }[]
}

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']

const partes = (fecha: Fecha) => fecha.split('-').map(Number) as [number, number, number]

/** "7 de octubre de 2026". */
export function fechaLarga(fecha: Fecha): string {
  const [a, m, d] = partes(fecha)
  return `${d} de ${MESES[m - 1]} de ${a}`
}

/** "Martes, 7 de octubre de 2026". */
export function fechaConDia(fecha: Fecha): string {
  const [a, m, d] = partes(fecha)
  const dia = DIAS[new Date(Date.UTC(a, m - 1, d)).getUTCDay()]
  return `${dia.charAt(0).toUpperCase()}${dia.slice(1)}, ${fechaLarga(fecha)}`
}

/** "del 1 de septiembre al 22 de diciembre de 2026", sin repetir el año si es el mismo. */
function periodo(inicio: Fecha, fin: Fecha): string {
  const mismoAño = inicio.slice(0, 4) === fin.slice(0, 4)
  const desde = mismoAño ? fechaLarga(inicio).replace(/ de \d{4}$/, '') : fechaLarga(inicio)
  return `del ${desde} al ${fechaLarga(fin)}`
}

const veces = (n: number, una: string, varias: string) => (n === 1 ? `1 ${una}` : `${n} ${varias}`)

const SANGRIA = '    '
const RAYA = '-'.repeat(60)

/** Un texto que puede tener varias líneas, sangrado para que se lea dentro de su apartado. */
function sangrado(texto: string, nivel = 2): string[] {
  return texto.split(/\r?\n/).map((linea) => (linea.trim() === '' ? '' : SANGRIA.repeat(nivel) + linea.trimEnd()))
}

function campo(nombre: string, valor: string): string[] {
  const lineas = valor.split(/\r?\n/)
  return lineas.length === 1 ? [`${SANGRIA}${nombre}: ${valor}`] : [`${SANGRIA}${nombre}:`, ...sangrado(valor)]
}

export function componerExportacion(d: DatosExportacion): string {
  const nombreTrimestre = NOMBRE_TRIMESTRE[d.trimestre.numero]
  const hechas = d.sesiones.filter((s) => !s.falta).length
  const faltas = d.sesiones.length - hechas

  const lineas: string[] = [
    `REGISTRO DEL ${nombreTrimestre.toUpperCase()}`,
    '='.repeat(60),
    '',
    `Alumno:      ${d.alumno.nombre} ${d.alumno.apellidos} (${d.alumno.codigo})`,
    `Curso:       ${d.curso}${d.nivelEducativo ? `, ${d.nivelEducativo}` : ''}`,
    `Trimestre:   ${nombreTrimestre}, ${periodo(d.trimestre.fechaInicio, d.trimestre.fechaFin)}`,
    `Sesiones:    ${veces(hechas, 'sesión', 'sesiones')}${faltas > 0 ? ` y ${veces(faltas, 'falta', 'faltas')}` : ''}`,
    `Exportado:   ${fechaLarga(d.hoy)}`
  ]
  if (!d.trimestre.cerrado) {
    lineas.push('', 'El trimestre sigue abierto: las valoraciones y las sesiones aún pueden cambiar.')
  }

  lineas.push('', '', 'OBJETIVOS DEL TRIMESTRE', RAYA, '')
  if (d.objetivos.length === 0) lineas.push('Este trimestre no tiene objetivos.', '')
  for (const o of d.objetivos) {
    const marcas = [o.arrastrado && 'arrastrado del trimestre anterior', o.estancado !== null && `estancado: ${o.estancado} trimestres seguidos pendiente de desarrollar`].filter(Boolean)
    lineas.push(`* ${o.enunciado}`)
    lineas.push(...campo('Valoración', o.valoracion))
    lineas.push(`${SANGRIA}${o.sesiones === 0 ? 'No aparece como trabajado en ninguna sesión' : `Trabajado en ${veces(o.sesiones, 'sesión', 'sesiones')}`}`)
    if (marcas.length > 0) lineas.push(`${SANGRIA}${marcas.join('; ').replace(/^./, (c) => c.toUpperCase())}`)
    if (o.comentario) lineas.push(...campo('Comentario', o.comentario))
    lineas.push('')
  }

  lineas.push('', 'SESIONES', RAYA, '')
  if (d.sesiones.length === 0) lineas.push('No hay sesiones registradas en este trimestre.', '')
  for (const s of d.sesiones) {
    if (s.falta) {
      lineas.push(`${fechaConDia(s.fecha)}: NO ACUDIÓ`)
      if (s.observaciones) lineas.push(...campo('Motivo', s.observaciones))
    } else {
      lineas.push(fechaConDia(s.fecha))
      if (s.estadoAlumno.length > 0) lineas.push(...campo('Estado', s.estadoAlumno.join(', ')))
      if (s.respuestaActividades.length > 0) lineas.push(...campo('Respuesta', s.respuestaActividades.join(', ')))
      if (s.objetivos.length > 0) lineas.push(...campo('Objetivos trabajados', s.objetivos.join('; ')))
      if (s.observaciones) lineas.push(...campo('Observaciones', s.observaciones))
      if (s.saludMedicacion) lineas.push(...campo('Salud o medicación', s.saludMedicacion))
    }
    lineas.push('')
  }

  return lineas.join('\r\n').replace(/(\r\n)+$/, '') + '\r\n'
}

/** "Lucía García Pérez - 2026-2027 - 1.er trimestre.txt", sin caracteres que Windows no admite en un nombre. */
export function nombreDeFichero(d: Pick<DatosExportacion, 'alumno' | 'curso' | 'trimestre'>): string {
  const nombre = `${d.alumno.nombre} ${d.alumno.apellidos} - ${d.curso.replace('/', '-')} - ${NOMBRE_TRIMESTRE[d.trimestre.numero]}`
  return `${nombre.replace(/[\\/:*?"<>|]/g, '').replace(/\s+/g, ' ').trim()}.txt`
}
