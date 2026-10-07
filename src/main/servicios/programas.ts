import type { DatosObjetivo, PendientesAnteriores, ResultadoPrograma, VistaPrograma } from '../../compartido/ipc'
import { pendientesAlAcabarCurso } from '../dominio/arrastre'
import type { CursoAcademico, Fecha, ProgramaIntervencion, Trimestre } from '../dominio/entidades'
import { normalizarEnunciado, validarEnunciado } from '../dominio/programa'
import { ETIQUETAS_VALORACION } from '../dominio/vocabulario'
import type { BaseDatos } from '../persistencia/baseDatos'
import { obtenerCurso, obtenerTrimestre, trimestresDeCurso } from '../persistencia/repositorioCursos'
import * as repositorio from '../persistencia/repositorioProgramas'
import { esId, textoOpcional } from './entrada'
import { hoyLocal } from './fecha'

/** Por qué esta asignación no puede cambiar de trimestre, o null si puede. */
function motivoParaNoMover(db: BaseDatos, asignacion: repositorio.AsignacionGuardada, trimestre: Trimestre): string | null {
  if (trimestre.estado === 'cerrado') return `El trimestre ${trimestre.numero} está cerrado.`
  if (asignacion.valoracion !== 'sin_valorar') return 'Ya está valorado en este trimestre: se trabajó aquí, así que no se mueve.'
  if (repositorio.trabajadoEnTrimestre(db, asignacion.objetivoId, trimestre.id)) {
    return 'Ya se trabajó en alguna sesión de este trimestre, así que no se mueve.'
  }
  if (repositorio.tieneContinuacion(db, asignacion.id)) return 'Ya continúa en otro trimestre.'
  return null
}

/** Por qué este objetivo no puede quitarse, o null si puede: solo lo puesto por error, sin rastro. */
function motivoParaNoQuitar(db: BaseDatos, objetivoId: number): string | null {
  const asignaciones = repositorio.asignacionesDeObjetivo(db, objetivoId)
  if (asignaciones.length !== 1) return 'Tiene historia en este curso: ya pasó por más de un trimestre.'
  if (asignaciones[0].valoracion !== 'sin_valorar') return 'Ya está valorado.'
  if (repositorio.tieneSesiones(db, objetivoId)) return 'Tiene sesiones asociadas.'
  return null
}

function vista(db: BaseDatos, programa: ProgramaIntervencion): VistaPrograma {
  const trimestres = new Map(trimestresDeCurso(db, programa.cursoAcademicoId).map((t) => [t.id, t]))
  return {
    id: programa.id,
    fechaCreacion: programa.fechaCreacion,
    fechaRevision: programa.fechaRevision,
    contenido: programa.contenido,
    asignaciones: repositorio.asignacionesDePrograma(db, programa.id).map((a) => ({
      asignacionId: a.asignacionId,
      objetivoId: a.objetivoId,
      enunciado: a.enunciado,
      trimestreId: a.trimestreId,
      numeroTrimestre: a.numeroTrimestre,
      valoracion: a.valoracion,
      etiquetaValoracion: ETIQUETAS_VALORACION[a.valoracion],
      arrastrado: a.asignacionAnteriorId !== null,
      puedeMoverse:
        motivoParaNoMover(
          db,
          { id: a.asignacionId, objetivoId: a.objetivoId, trimestreId: a.trimestreId, valoracion: a.valoracion, asignacionAnteriorId: a.asignacionAnteriorId },
          trimestres.get(a.trimestreId)!
        ) === null,
      puedeQuitarse: motivoParaNoQuitar(db, a.objetivoId) === null
    }))
  }
}

function cerrado(curso: CursoAcademico): string | null {
  return curso.estado === 'cerrado' ? `El curso ${curso.curso} está cerrado y su programa ya no cambia.` : null
}

/** El programa y el curso al que pertenece, o el motivo por el que no se puede tocar. */
function programaModificable(db: BaseDatos, programaId: unknown) {
  const programa = esId(programaId) ? repositorio.obtenerPrograma(db, programaId) : null
  if (!programa) return { rechazo: 'Este programa no existe.' } as const
  const curso = obtenerCurso(db, programa.cursoAcademicoId)!
  const motivo = cerrado(curso)
  return motivo ? ({ rechazo: motivo } as const) : ({ programa, curso } as const)
}

export function programaDeCurso(db: BaseDatos, cursoId: unknown): VistaPrograma | null {
  const programa = esId(cursoId) ? repositorio.programaDeCurso(db, cursoId) : null
  return programa ? vista(db, programa) : null
}

/** Los objetivos del 3.er trimestre del curso anterior que acabaron sin conseguir o sin abordar. */
function pendientesDe(db: BaseDatos, curso: CursoAcademico) {
  if (curso.cursoAnteriorId === null) return null
  const anterior = obtenerCurso(db, curso.cursoAnteriorId)!
  const programaAnterior = repositorio.programaDeCurso(db, anterior.id)
  const asignaciones = programaAnterior ? repositorio.asignacionesDePrograma(db, programaAnterior.id) : []
  const pendientes = pendientesAlAcabarCurso(
    asignaciones.map((a) => ({ ...a, id: a.asignacionId }))
  )
  return { anterior, pendientes }
}

export function pendientesDelCursoAnterior(db: BaseDatos, cursoId: unknown): PendientesAnteriores | null {
  const curso = esId(cursoId) ? obtenerCurso(db, cursoId) : null
  const encontrados = curso && pendientesDe(db, curso)
  if (!encontrados || encontrados.pendientes.length === 0) return null
  return {
    curso: encontrados.anterior.curso,
    objetivos: encontrados.pendientes.map((p) => ({
      asignacionId: p.asignacionId,
      enunciado: p.enunciado,
      valoracion: p.valoracion,
      etiquetaValoracion: ETIQUETAS_VALORACION[p.valoracion]
    }))
  }
}

/**
 * Crea el programa y, si ella los marca, continúa los objetivos pendientes del curso anterior: cada
 * uno se crea como objetivo nuevo de este curso, con el enunciado copiado, en el 1.er trimestre y
 * enlazado a su último trimestre del curso anterior. Reformularlo después no toca el del año pasado.
 */
export function crearPrograma(
  db: BaseDatos,
  cursoId: unknown,
  contenido: unknown,
  arrastrar: unknown = [],
  hoy: Fecha = hoyLocal()
): ResultadoPrograma {
  const curso = esId(cursoId) ? obtenerCurso(db, cursoId) : null
  if (!curso) return { tipo: 'rechazado', mensaje: 'Este curso no existe.' }
  const motivo = cerrado(curso)
  if (motivo) return { tipo: 'rechazado', mensaje: motivo }
  if (repositorio.programaDeCurso(db, curso.id)) {
    return { tipo: 'rechazado', mensaje: `El curso ${curso.curso} ya tiene programa de intervención.` }
  }

  const pedidos = Array.isArray(arrastrar) ? arrastrar.filter(esId) : []
  const pendientes = pendientesDe(db, curso)?.pendientes ?? []
  const elegidos = pendientes.filter((p) => pedidos.includes(p.asignacionId))
  if (elegidos.length !== new Set(pedidos).size) {
    return { tipo: 'rechazado', mensaje: 'Alguno de los objetivos elegidos no está pendiente del curso anterior.' }
  }
  const primerTrimestre = trimestresDeCurso(db, curso.id).find((t) => t.numero === 1)!

  const id = db.transaction(() => {
    const nuevo = repositorio.insertarPrograma(db, curso.id, textoOpcional(contenido), hoy)
    for (const p of elegidos) {
      repositorio.insertarObjetivoConAsignacion(db, nuevo, p.enunciado, primerTrimestre.id, hoy, p.asignacionId)
    }
    return nuevo
  })()
  return { tipo: 'guardado', programa: vista(db, repositorio.obtenerPrograma(db, id)!) }
}

export function editarContenido(db: BaseDatos, programaId: unknown, contenido: unknown, hoy: Fecha = hoyLocal()): ResultadoPrograma {
  const encontrado = programaModificable(db, programaId)
  if ('rechazo' in encontrado) return { tipo: 'rechazado', mensaje: encontrado.rechazo! }

  repositorio.actualizarContenido(db, encontrado.programa.id, textoOpcional(contenido), hoy)
  return { tipo: 'guardado', programa: vista(db, repositorio.obtenerPrograma(db, encontrado.programa.id)!) }
}

/**
 * Un objetivo nace en un único trimestre, sin valorar. Si no se consigue, pasa al siguiente por
 * arrastre al cerrar, y ese paso queda enlazado: así cada trimestre de su recorrido tiene valoración.
 */
export function anadirObjetivo(
  db: BaseDatos,
  programaId: unknown,
  entrada: Partial<DatosObjetivo>,
  hoy: Fecha = hoyLocal()
): ResultadoPrograma {
  const encontrado = programaModificable(db, programaId)
  if ('rechazo' in encontrado) return { tipo: 'rechazado', mensaje: encontrado.rechazo! }
  const { programa, curso } = encontrado

  const enunciado = normalizarEnunciado(entrada?.enunciado)
  const trimestre = trimestresDeCurso(db, curso.id).find((t) => t.id === entrada?.trimestreId)
  const problemas = validarEnunciado(enunciado)
  if (!trimestre) problemas.push({ campo: 'trimestre', mensaje: 'Elige uno de los trimestres de este curso.' })
  else if (trimestre.estado === 'cerrado') {
    problemas.push({ campo: 'trimestre', mensaje: `El trimestre ${trimestre.numero} está cerrado: elige uno abierto.` })
  }
  if (problemas.length > 0) return { tipo: 'invalido', problemas }

  db.transaction(() => {
    repositorio.insertarObjetivoConAsignacion(db, programa.id, enunciado, trimestre!.id, hoy)
    repositorio.marcarRevision(db, programa.id, hoy)
  })()
  return { tipo: 'guardado', programa: vista(db, repositorio.obtenerPrograma(db, programa.id)!) }
}

/** El objetivo y su programa, si el curso sigue activo. */
type ObjetivoModificable =
  | { rechazo: string }
  | { rechazo?: undefined; programa: ProgramaIntervencion; curso: CursoAcademico; objetivo: repositorio.ObjetivoGuardado }

function objetivoModificable(db: BaseDatos, objetivoId: unknown): ObjetivoModificable {
  const objetivo = esId(objetivoId) ? repositorio.obtenerObjetivo(db, objetivoId) : null
  if (!objetivo) return { rechazo: 'Este objetivo no existe.' }
  const encontrado = programaModificable(db, objetivo.programaId)
  if ('rechazo' in encontrado && encontrado.rechazo) return { rechazo: encontrado.rechazo }
  return { programa: encontrado.programa!, curso: encontrado.curso!, objetivo }
}

function guardado(db: BaseDatos, programaId: number): ResultadoPrograma {
  return { tipo: 'guardado', programa: vista(db, repositorio.obtenerPrograma(db, programaId)!) }
}

/**
 * Corrige o reformula el enunciado. El cambio se ve en todos sus trimestres de este curso; los
 * documentos ya generados guardan su texto, y el curso anterior no se toca nunca.
 */
export function editarObjetivo(db: BaseDatos, objetivoId: unknown, enunciado: unknown, hoy: Fecha = hoyLocal()): ResultadoPrograma {
  const encontrado = objetivoModificable(db, objetivoId)
  if (encontrado.rechazo !== undefined) return { tipo: 'rechazado', mensaje: encontrado.rechazo }

  const texto = normalizarEnunciado(enunciado)
  const problemas = validarEnunciado(texto)
  if (problemas.length > 0) return { tipo: 'invalido', problemas }

  db.transaction(() => {
    repositorio.actualizarEnunciado(db, encontrado.objetivo.id, texto)
    repositorio.marcarRevision(db, encontrado.programa.id, hoy)
  })()
  return guardado(db, encontrado.programa.id)
}

/**
 * Lleva el objetivo a otro trimestre. Solo se mueve el trimestre en el que está ahora, sin valorar, a
 * otro abierto; si vino arrastrado dentro del curso, siempre hacia delante, para no romper la cadena.
 */
export function moverObjetivo(db: BaseDatos, asignacionId: unknown, trimestreId: unknown, hoy: Fecha = hoyLocal()): ResultadoPrograma {
  const asignacion = esId(asignacionId) ? repositorio.obtenerAsignacion(db, asignacionId) : null
  if (!asignacion) return { tipo: 'rechazado', mensaje: 'Este objetivo no existe.' }
  const encontrado = objetivoModificable(db, asignacion.objetivoId)
  if (encontrado.rechazo !== undefined) return { tipo: 'rechazado', mensaje: encontrado.rechazo }

  const actual = obtenerTrimestre(db, asignacion.trimestreId)!
  const motivo = motivoParaNoMover(db, asignacion, actual)
  if (motivo) return { tipo: 'rechazado', mensaje: motivo }

  const destino = esId(trimestreId) ? obtenerTrimestre(db, trimestreId) : null
  const invalido = (mensaje: string): ResultadoPrograma => ({ tipo: 'invalido', problemas: [{ campo: 'trimestre', mensaje }] })
  if (!destino || destino.cursoAcademicoId !== actual.cursoAcademicoId) return invalido('Elige uno de los trimestres de este curso.')
  if (destino.id === actual.id) return invalido('Ya está en ese trimestre.')
  if (destino.estado === 'cerrado') return invalido(`El trimestre ${destino.numero} está cerrado: elige uno abierto.`)

  const anterior = asignacion.asignacionAnteriorId === null ? null : repositorio.obtenerAsignacion(db, asignacion.asignacionAnteriorId)
  const trimestreAnterior = anterior ? obtenerTrimestre(db, anterior.trimestreId)! : null
  if (trimestreAnterior && trimestreAnterior.cursoAcademicoId === actual.cursoAcademicoId && destino.numero <= trimestreAnterior.numero) {
    return invalido(`Viene arrastrado del trimestre ${trimestreAnterior.numero}: solo puede ir a uno posterior.`)
  }
  if (repositorio.asignacionesDeObjetivo(db, asignacion.objetivoId).some((a) => a.trimestreId === destino.id)) {
    return invalido('Ese objetivo ya está en ese trimestre.')
  }

  db.transaction(() => {
    repositorio.cambiarTrimestre(db, asignacion.id, destino.id)
    repositorio.marcarRevision(db, encontrado.programa.id, hoy)
  })()
  return guardado(db, encontrado.programa.id)
}

/** Quita un objetivo puesto por error. Si se trajo del curso anterior, equivale a no haberlo traído. */
export function quitarObjetivo(db: BaseDatos, objetivoId: unknown, hoy: Fecha = hoyLocal()): ResultadoPrograma {
  const encontrado = objetivoModificable(db, objetivoId)
  if (encontrado.rechazo !== undefined) return { tipo: 'rechazado', mensaje: encontrado.rechazo }
  const motivo = motivoParaNoQuitar(db, encontrado.objetivo.id)
  if (motivo) return { tipo: 'rechazado', mensaje: motivo }

  db.transaction(() => {
    repositorio.borrarObjetivo(db, encontrado.objetivo.id)
    repositorio.marcarRevision(db, encontrado.programa.id, hoy)
  })()
  return guardado(db, encontrado.programa.id)
}
