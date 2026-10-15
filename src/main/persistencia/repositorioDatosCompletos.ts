import type { Tablas } from '../dominio/datosCompletos'
import type { BaseDatos } from './baseDatos'

/** Todas las filas de todas las tablas con datos suyos, tal cual, para la exportación completa. */
export function leerTablas(db: BaseDatos): Tablas {
  const todas = <T>(sql: string) => db.prepare(sql).all() as T[]
  return {
    alumnos: todas(
      `SELECT id, codigo_interno AS codigoInterno, nombre, apellidos, fecha_nacimiento AS fechaNacimiento, diagnosticos, notas FROM alumno`
    ),
    cursos: todas(
      `SELECT id, alumno_id AS alumnoId, curso, nivel_educativo AS nivelEducativo, estado, curso_anterior_id AS cursoAnteriorId FROM curso_academico`
    ),
    trimestres: todas(
      `SELECT id, curso_academico_id AS cursoId, numero, fecha_inicio AS fechaInicio, fecha_fin AS fechaFin, estado FROM trimestre`
    ),
    evaluaciones: todas(`SELECT curso_academico_id AS cursoId, fecha, instrumento, contenido FROM evaluacion_inicial`),
    programas: todas(
      `SELECT id, curso_academico_id AS cursoId, fecha_creacion AS fechaCreacion, fecha_revision AS fechaRevision, contenido FROM programa_intervencion`
    ),
    objetivos: todas(`SELECT id, programa_id AS programaId, enunciado, fecha_creacion AS fechaCreacion FROM objetivo`),
    asignaciones: todas(
      `SELECT id, objetivo_id AS objetivoId, trimestre_id AS trimestreId, valoracion, comentario, asignacion_anterior_id AS asignacionAnteriorId FROM asignacion_trimestral`
    ),
    sesiones: todas<Omit<Tablas['sesiones'][number], 'falta'> & { falta: number }>(
      `SELECT id, trimestre_id AS trimestreId, fecha, falta, estado_alumno AS estadoAlumno, respuesta_actividades AS respuestaActividades,
              observaciones, salud_medicacion AS saludMedicacion FROM sesion`
    ).map((s) => ({ ...s, falta: s.falta === 1 })),
    sesionObjetivos: todas(`SELECT sesion_id AS sesionId, objetivo_id AS objetivoId FROM sesion_objetivo`),
    actas: todas(`SELECT curso_academico_id AS cursoId, fecha, asistentes, contenido, acuerdos FROM acta_reunion`),
    opciones: todas<{ categoria: string; texto: string; orden: number; activa: number }>(
      `SELECT categoria, texto, orden, activa FROM opcion_catalogo`
    ).map((o) => ({ ...o, activa: o.activa === 1 })),
    calendario: todas(`SELECT curso, numero, fecha_inicio AS fechaInicio, fecha_fin AS fechaFin FROM calendario_trimestre`)
  }
}
