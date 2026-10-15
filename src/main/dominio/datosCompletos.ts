import { NOMBRE_TRIMESTRE } from './calendario'
import type { NumeroTrimestre } from './entidades'
import { fechaLarga } from './exportacion'
import { ETIQUETAS_VALORACION, type Valoracion } from './vocabulario'

/**
 * T7.1 (RF-26, P1): todos sus datos en un formato abierto que se entiende sin la aplicación. Se
 * organizan como ella piensa, por alumno y curso, no como tablas de la base de datos. Las filas
 * llegan tal cual de la base; aquí solo se ordenan y se nombran.
 */
export interface Tablas {
  alumnos: { id: number; codigoInterno: string; nombre: string; apellidos: string; fechaNacimiento: string | null; diagnosticos: string | null; notas: string | null }[]
  cursos: { id: number; alumnoId: number; curso: string; nivelEducativo: string | null; estado: string; cursoAnteriorId: number | null }[]
  trimestres: { id: number; cursoId: number; numero: NumeroTrimestre; fechaInicio: string; fechaFin: string; estado: string }[]
  evaluaciones: { cursoId: number; fecha: string; instrumento: string | null; contenido: string | null }[]
  programas: { id: number; cursoId: number; fechaCreacion: string; fechaRevision: string | null; contenido: string | null }[]
  objetivos: { id: number; programaId: number; enunciado: string; fechaCreacion: string }[]
  asignaciones: { id: number; objetivoId: number; trimestreId: number; valoracion: Valoracion; comentario: string | null; asignacionAnteriorId: number | null }[]
  sesiones: {
    id: number
    trimestreId: number
    fecha: string
    falta: boolean
    estadoAlumno: string | null
    respuestaActividades: string | null
    observaciones: string | null
    saludMedicacion: string | null
  }[]
  sesionObjetivos: { sesionId: number; objetivoId: number }[]
  actas: { cursoId: number; fecha: string; asistentes: string | null; contenido: string | null; acuerdos: string | null }[]
  opciones: { categoria: string; texto: string; orden: number; activa: boolean }[]
  calendario: { curso: string; numero: NumeroTrimestre; fechaInicio: string; fechaFin: string }[]
}

const separar = (texto: string | null) => (texto ? texto.split(', ') : [])
const porFecha = <T extends { fecha: string }>(a: T, b: T) => a.fecha.localeCompare(b.fecha)

export function componerDatosCompletos(t: Tablas, exportado: string, versionEsquema: number) {
  const cursoPorId = new Map(t.cursos.map((c) => [c.id, c]))
  const trimestrePorId = new Map(t.trimestres.map((tr) => [tr.id, tr]))
  const asignacionPorId = new Map(t.asignaciones.map((a) => [a.id, a]))
  const objetivoPorId = new Map(t.objetivos.map((o) => [o.id, o]))
  const nombreTrimestre = (trimestreId: number) => NOMBRE_TRIMESTRE[trimestrePorId.get(trimestreId)!.numero]

  /** De dónde viene un objetivo arrastrado: el curso y el trimestre de su asignación anterior. */
  function vieneDe(asignacionAnteriorId: number | null) {
    if (asignacionAnteriorId === null) return null
    const anterior = asignacionPorId.get(asignacionAnteriorId)!
    const trimestre = trimestrePorId.get(anterior.trimestreId)!
    return { curso: cursoPorId.get(trimestre.cursoId)!.curso, trimestre: NOMBRE_TRIMESTRE[trimestre.numero] }
  }

  function curso(c: Tablas['cursos'][number]) {
    const trimestres = t.trimestres.filter((tr) => tr.cursoId === c.id).sort((a, b) => a.numero - b.numero)
    const idsTrimestres = new Set(trimestres.map((tr) => tr.id))
    const evaluacion = t.evaluaciones.find((e) => e.cursoId === c.id)
    const programa = t.programas.find((p) => p.cursoId === c.id)

    return {
      curso: c.curso,
      nivelEducativo: c.nivelEducativo,
      estado: c.estado,
      continuaElCurso: c.cursoAnteriorId === null ? null : cursoPorId.get(c.cursoAnteriorId)!.curso,
      trimestres: trimestres.map((tr) => ({
        trimestre: NOMBRE_TRIMESTRE[tr.numero],
        inicio: tr.fechaInicio,
        fin: tr.fechaFin,
        estado: tr.estado
      })),
      evaluacionInicial: evaluacion ? { fecha: evaluacion.fecha, instrumento: evaluacion.instrumento, contenido: evaluacion.contenido } : null,
      programa: programa
        ? {
            creado: programa.fechaCreacion,
            revisado: programa.fechaRevision,
            contenido: programa.contenido,
            objetivos: t.objetivos
              .filter((o) => o.programaId === programa.id)
              .sort((a, b) => a.id - b.id)
              .map((o) => ({
                enunciado: o.enunciado,
                creado: o.fechaCreacion,
                trimestres: t.asignaciones
                  .filter((a) => a.objetivoId === o.id)
                  .sort((a, b) => trimestrePorId.get(a.trimestreId)!.numero - trimestrePorId.get(b.trimestreId)!.numero)
                  .map((a) => ({
                    trimestre: nombreTrimestre(a.trimestreId),
                    valoracion: ETIQUETAS_VALORACION[a.valoracion],
                    comentario: a.comentario,
                    vieneDe: vieneDe(a.asignacionAnteriorId)
                  }))
              }))
          }
        : null,
      sesiones: t.sesiones
        .filter((s) => idsTrimestres.has(s.trimestreId))
        .sort((a, b) => porFecha(a, b) || a.id - b.id)
        .map((s) => ({
          fecha: s.fecha,
          trimestre: nombreTrimestre(s.trimestreId),
          noAcudio: s.falta,
          estadoDelAlumno: separar(s.estadoAlumno),
          respuestaALasActividades: separar(s.respuestaActividades),
          objetivosTrabajados: t.sesionObjetivos
            .filter((so) => so.sesionId === s.id)
            .map((so) => objetivoPorId.get(so.objetivoId)!.enunciado),
          observaciones: s.observaciones,
          saludOMedicacion: s.saludMedicacion
        })),
      actas: t.actas
        .filter((a) => a.cursoId === c.id)
        .sort(porFecha)
        .map((a) => ({ fecha: a.fecha, asistentes: a.asistentes, contenido: a.contenido, acuerdos: a.acuerdos }))
    }
  }

  const opciones = (categoria: string) =>
    t.opciones
      .filter((o) => o.categoria === categoria)
      .sort((a, b) => a.orden - b.orden)
      .map((o) => ({ texto: o.texto, activa: o.activa }))

  const cursosEscolares = [...new Set(t.calendario.map((c) => c.curso))].sort()

  return {
    aplicacion: 'Ariadne',
    descripcion: 'Todos los datos registrados en Ariadne, organizados por alumno y curso.',
    exportado,
    versionDelEsquema: versionEsquema,
    calendario: cursosEscolares.map((cursoEscolar) => ({
      curso: cursoEscolar,
      trimestres: t.calendario
        .filter((c) => c.curso === cursoEscolar)
        .sort((a, b) => a.numero - b.numero)
        .map((c) => ({ trimestre: NOMBRE_TRIMESTRE[c.numero], inicio: c.fechaInicio, fin: c.fechaFin }))
    })),
    opcionesDelRegistro: {
      estadoDelAlumno: opciones('estado_alumno'),
      respuestaALasActividades: opciones('respuesta_actividades')
    },
    alumnos: [...t.alumnos]
      .sort((a, b) => `${a.apellidos} ${a.nombre}`.localeCompare(`${b.apellidos} ${b.nombre}`, 'es'))
      .map((a) => ({
        codigo: a.codigoInterno,
        nombre: a.nombre,
        apellidos: a.apellidos,
        fechaNacimiento: a.fechaNacimiento,
        diagnosticos: a.diagnosticos,
        notas: a.notas,
        cursos: t.cursos
          .filter((c) => c.alumnoId === a.id)
          .sort((x, y) => x.curso.localeCompare(y.curso))
          .map(curso)
      }))
  }
}

export type DatosCompletos = ReturnType<typeof componerDatosCompletos>

/** Lo que acompaña a los datos: qué es cada fichero, para quien lo abra sin la aplicación. */
export function textoLeeme(exportado: string): string {
  return [
    'TODOS LOS DATOS DE ARIADNE',
    '',
    `Exportados el ${fechaLarga(exportado)}. Esta carpeta contiene todo lo que registraste en Ariadne:`,
    '',
    '* ariadne.sqlite: la base de datos completa. Sirve para recuperarlo todo en Ariadne: en "Copias de seguridad", "Restaurar desde un fichero".',
    '',
    '* ariadne-datos.json: los mismos datos en un formato abierto (JSON), organizados por alumno y curso: ficha, trimestres, evaluación inicial, programa con sus objetivos y valoraciones, sesiones y actas. Se puede abrir con cualquier editor de texto y leer sin Ariadne.',
    '',
    'Son datos de menores: guárdalos en un lugar seguro.',
    ''
  ].join('\r\n')
}
