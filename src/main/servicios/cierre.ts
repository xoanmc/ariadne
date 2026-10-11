import { NOMBRE_TRIMESTRE } from '../dominio/calendario'
import { ETIQUETAS_VALORACION, esValoracion, type Valoracion } from '../dominio/vocabulario'
import type { BaseDatos } from '../persistencia/baseDatos'
import { obtenerCurso, obtenerTrimestre } from '../persistencia/repositorioCursos'
import { obtenerAsignacion, valorarAsignacion } from '../persistencia/repositorioProgramas'
import { esId, textoOpcional } from './entrada'

export type ResultadoValoracion =
  | { tipo: 'guardado'; asignacionId: number; valoracion: Valoracion; etiquetaValoracion: string; comentario: string | null }
  | { tipo: 'rechazado'; mensaje: string }

/**
 * Valora un objetivo en su trimestre (RF-16). Se puede hacer en cualquier momento mientras el trimestre
 * siga abierto, cambiarla o volver a dejarla sin valorar: lo que la fija es el cierre. Lo que digan las
 * sesiones no la condiciona; las incoherencias las señala la verificación de cierre, y el criterio es suyo.
 */
export function valorarObjetivo(db: BaseDatos, asignacionId: unknown, valoracion: unknown, comentario: unknown): ResultadoValoracion {
  const asignacion = esId(asignacionId) ? obtenerAsignacion(db, asignacionId) : null
  if (!asignacion) return { tipo: 'rechazado', mensaje: 'Ese objetivo no existe.' }
  if (typeof valoracion !== 'string' || !esValoracion(valoracion)) return { tipo: 'rechazado', mensaje: 'Elige una valoración.' }

  const trimestre = obtenerTrimestre(db, asignacion.trimestreId)!
  const curso = obtenerCurso(db, trimestre.cursoAcademicoId)!
  if (trimestre.estado === 'cerrado' || curso.estado === 'cerrado') {
    return {
      tipo: 'rechazado',
      mensaje: `Ese objetivo es del ${NOMBRE_TRIMESTRE[trimestre.numero]}, que ya está cerrado: su valoración no se cambia.`
    }
  }

  const texto = textoOpcional(comentario)
  valorarAsignacion(db, asignacion.id, valoracion, texto)
  return { tipo: 'guardado', asignacionId: asignacion.id, valoracion, etiquetaValoracion: ETIQUETAS_VALORACION[valoracion], comentario: texto }
}
