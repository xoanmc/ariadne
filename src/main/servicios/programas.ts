import type { DatosObjetivo, PendientesAnteriores, ResultadoPrograma, VistaPrograma } from '../../compartido/ipc'
import { pendientesAlAcabarCurso } from '../dominio/arrastre'
import type { CursoAcademico, Fecha, ProgramaIntervencion } from '../dominio/entidades'
import { normalizarEnunciado, validarEnunciado } from '../dominio/programa'
import { ETIQUETAS_VALORACION } from '../dominio/vocabulario'
import type { BaseDatos } from '../persistencia/baseDatos'
import { obtenerCurso, trimestresDeCurso } from '../persistencia/repositorioCursos'
import * as repositorio from '../persistencia/repositorioProgramas'
import { esId, textoOpcional } from './entrada'
import { hoyLocal } from './fecha'

function vista(db: BaseDatos, programa: ProgramaIntervencion): VistaPrograma {
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
      arrastrado: a.asignacionAnteriorId !== null
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
