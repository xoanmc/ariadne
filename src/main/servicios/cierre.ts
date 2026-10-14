import type { ResultadoValoracion, VistaVerificacion } from '../../compartido/ipc'
import { NOMBRE_TRIMESTRE } from '../dominio/calendario'
import { incoherenciaDe, verificarTrimestre, type Incoherencia, type ObjetivoEnVerificacion } from '../dominio/cierre'
import { ETIQUETAS_VALORACION, esValoracion, type Valoracion } from '../dominio/vocabulario'
import type { BaseDatos } from '../persistencia/baseDatos'
import { obtenerCurso, obtenerTrimestre } from '../persistencia/repositorioCursos'
import { asignacionesDeTrimestre, obtenerAsignacion, valorarAsignacion } from '../persistencia/repositorioProgramas'
import { recuentoDeTrimestre, sesionesPorObjetivo } from '../persistencia/repositorioSesiones'
import { esId, textoOpcional } from './entrada'

const enSesiones = (n: number) => (n === 1 ? 'una sesión' : `${n} sesiones`)

function aviso(tipo: Incoherencia, valoracion: Valoracion, sesiones: number): string {
  return tipo === 'no_trabajado_con_sesiones'
    ? `Lo valoraste como pendiente de desarrollar, pero aparece como trabajado en ${enSesiones(sesiones)}.`
    : `Lo valoraste como ${ETIQUETAS_VALORACION[valoracion]}, pero no aparece como trabajado en ninguna sesión.`
}

/**
 * RF-17: lo que verá en la pantalla de cierre. Todo sale de consultar los datos: sus valoraciones, los
 * objetivos que marcó en cada sesión y cuántas sesiones y faltas hubo.
 */
export function verificacionDeTrimestre(db: BaseDatos, trimestreId: unknown): VistaVerificacion | null {
  const trimestre = esId(trimestreId) ? obtenerTrimestre(db, trimestreId) : null
  if (!trimestre) return null
  const curso = obtenerCurso(db, trimestre.cursoAcademicoId)!
  const porObjetivo = sesionesPorObjetivo(db, trimestre.id)
  const filas = asignacionesDeTrimestre(db, trimestre.id)
  const objetivos: ObjetivoEnVerificacion[] = filas.map((f) => ({
    asignacionId: f.asignacionId,
    objetivoId: f.objetivoId,
    valoracion: f.valoracion,
    sesiones: porObjetivo.get(f.objetivoId) ?? 0
  }))
  const verificacion = verificarTrimestre(objetivos, recuentoDeTrimestre(db, trimestre.id))

  return {
    trimestreId: trimestre.id,
    nombreTrimestre: NOMBRE_TRIMESTRE[trimestre.numero],
    abierto: trimestre.estado === 'abierto' && curso.estado === 'activo',
    objetivos: filas.map((f, i) => {
      const tipo = incoherenciaDe(objetivos[i])
      return {
        asignacionId: f.asignacionId,
        objetivoId: f.objetivoId,
        enunciado: f.enunciado,
        valoracion: f.valoracion,
        etiquetaValoracion: ETIQUETAS_VALORACION[f.valoracion],
        comentario: f.comentario,
        arrastrado: f.asignacionAnteriorId !== null,
        sesiones: objetivos[i].sesiones,
        aviso: tipo ? aviso(tipo, f.valoracion, objetivos[i].sesiones) : null
      }
    }),
    sinValorar: verificacion.sinValorar.length,
    noTrabajados: verificacion.noTrabajados.length,
    sinSesiones: verificacion.sinSesiones.length,
    sesiones: verificacion.sesiones,
    faltas: verificacion.faltas,
    puedeCerrarse: verificacion.puedeCerrarse
  }
}

/**
 * Valora un objetivo en su trimestre (RF-16). Se puede hacer en cualquier momento mientras el trimestre
 * siga abierto, cambiarla o volver a dejarla sin valorar: lo que la fija es el cierre. Lo que digan las
 * sesiones no la condiciona; las incoherencias las señala la verificación, y el criterio es suyo.
 * Devuelve la verificación ya recalculada, para que la pantalla de cierre se actualice al instante.
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

  valorarAsignacion(db, asignacion.id, valoracion, textoOpcional(comentario))
  return { tipo: 'guardado', verificacion: verificacionDeTrimestre(db, trimestre.id)! }
}
