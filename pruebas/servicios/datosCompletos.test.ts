import type Database from 'better-sqlite3'
import { beforeEach, describe, expect, it } from 'vitest'
import type { DatosSesion, PeriodoTrimestre, VistaCurso } from '../../src/compartido/ipc'
import type { DatosCompletos } from '../../src/main/dominio/datosCompletos'
import { registrarActa } from '../../src/main/servicios/actas'
import { darDeAlta } from '../../src/main/servicios/alumnos'
import { cerrarTrimestre, valorarObjetivo } from '../../src/main/servicios/cierre'
import { exportacionCompleta } from '../../src/main/servicios/datosCompletos'
import { guardarEvaluacion } from '../../src/main/servicios/evaluaciones'
import { anadirObjetivo, crearPrograma, pendientesDelCursoAnterior, programaDeCurso } from '../../src/main/servicios/programas'
import { registrarSesion } from '../../src/main/servicios/sesiones'
import { crearBaseDePrueba } from '../ayudas/baseDePrueba'
import { abrirCursoDePrueba } from '../ayudas/cursoDePrueba'

const periodos = (curso: string): PeriodoTrimestre[] => {
  const [a, b] = curso.split('/')
  return [
    { numero: 1, fechaInicio: `${a}-09-10`, fechaFin: `${a}-12-22` },
    { numero: 2, fechaInicio: `${b}-01-08`, fechaFin: `${b}-03-26` },
    { numero: 3, fechaInicio: `${b}-04-06`, fechaFin: `${b}-06-23` }
  ]
}
const sesion = (fecha: string, extra: Partial<DatosSesion> = {}): DatosSesion => ({
  fecha,
  objetivos: [],
  estadoAlumno: ['Tranquilo', 'Cansado'],
  respuestaActividades: ['Participa'],
  observaciones: null,
  saludMedicacion: null,
  falta: false,
  ...extra
})

let db: Database.Database

function alumno(nombre: string, apellidos: string): number {
  const r = darDeAlta(db, { nombre, apellidos, fechaNacimiento: '2018-03-04', diagnosticos: 'TEA', notas: 'Le gusta dibujar' }, true, '2025-09-15')
  if (r.tipo !== 'creado') throw new Error('alta fallida')
  return r.alumno.id
}

function abrir(alumnoId: number, curso: string): VistaCurso {
  const r = abrirCursoDePrueba(db, alumnoId, { curso, nivelEducativo: '3.º de Primaria', periodos: periodos(curso) })
  if (r.tipo !== 'guardado') throw new Error('apertura fallida')
  return r.curso
}

/**
 * Una base con de todo: dos alumnos, uno con dos cursos y un objetivo arrastrado entre ellos,
 * evaluaciones, actas, sesiones con objetivos, faltas y salud.
 */
function baseCompleta() {
  const lucia = alumno('Lucía', 'García Pérez')
  alumno('Ana', 'Álvarez Gil')
  const anterior = abrir(lucia, '2025/2026')
  guardarEvaluacion(db, anterior.id, { fecha: '2025-09-20', instrumento: 'Observación', contenido: 'Lee con dificultad' }, '2025-09-20')
  crearPrograma(db, anterior.id, 'Programa del curso', [], '2025-09-20')
  const programa = programaDeCurso(db, anterior.id)!
  const r = anadirObjetivo(db, programa.id, { enunciado: 'Mejorar la fluidez lectora', trimestreId: anterior.trimestres[2].id }, '2025-09-20')
  if (r.tipo !== 'guardado') throw new Error('objetivo fallido')
  const fluidez = r.programa.asignaciones[0]
  registrarSesion(db, lucia, sesion('2026-04-10', { objetivos: [fluidez.objetivoId], observaciones: 'Leyó el cuento' }), '2026-06-30')
  registrarSesion(db, lucia, sesion('2026-04-17', { falta: true, observaciones: 'Enfermo' }), '2026-06-30')
  registrarActa(db, anterior.id, { fecha: '2026-05-05', asistentes: 'Madre', contenido: 'Reunión de seguimiento', acuerdos: 'Leer en casa' }, '2026-06-30')
  valorarObjetivo(db, fluidez.asignacionId, 'no_conseguido', 'Silabea')
  for (const t of anterior.trimestres) cerrarTrimestre(db, t.id, [])

  const actual = abrir(lucia, '2026/2027')
  crearPrograma(db, actual.id, null, [pendientesDelCursoAnterior(db, actual.id)!.objetivos[0].asignacionId], '2026-09-20')
  registrarSesion(db, lucia, sesion('2026-10-06', { saludMedicacion: 'Tomó su medicación' }), '2026-10-15')
  return exportacionCompleta(db, '2026-10-15')
}

beforeEach(() => {
  db = crearBaseDePrueba()
})

describe('exportación completa (T7.1)', () => {
  it('no se deja nada: cada fila de la base aparece en el JSON', () => {
    const datos = JSON.parse(baseCompleta().json) as DatosCompletos
    const cuenta = (tabla: string) => (db.prepare(`SELECT count(*) AS n FROM ${tabla}`).get() as { n: number }).n
    const cursos = datos.alumnos.flatMap((a) => a.cursos)
    const objetivos = cursos.flatMap((c) => c.programa?.objetivos ?? [])

    expect(datos.alumnos).toHaveLength(cuenta('alumno'))
    expect(cursos).toHaveLength(cuenta('curso_academico'))
    expect(cursos.flatMap((c) => c.trimestres)).toHaveLength(cuenta('trimestre'))
    expect(cursos.filter((c) => c.evaluacionInicial)).toHaveLength(cuenta('evaluacion_inicial'))
    expect(cursos.filter((c) => c.programa)).toHaveLength(cuenta('programa_intervencion'))
    expect(objetivos).toHaveLength(cuenta('objetivo'))
    expect(objetivos.flatMap((o) => o.trimestres)).toHaveLength(cuenta('asignacion_trimestral'))
    expect(cursos.flatMap((c) => c.sesiones)).toHaveLength(cuenta('sesion'))
    expect(cursos.flatMap((c) => c.sesiones.flatMap((s) => s.objetivosTrabajados))).toHaveLength(cuenta('sesion_objetivo'))
    expect(cursos.flatMap((c) => c.actas)).toHaveLength(cuenta('acta_reunion'))
    expect([...datos.opcionesDelRegistro.estadoDelAlumno, ...datos.opcionesDelRegistro.respuestaALasActividades]).toHaveLength(cuenta('opcion_catalogo'))
    expect(datos.calendario.flatMap((c) => c.trimestres)).toHaveLength(cuenta('calendario_trimestre'))
  })

  it('si la base tiene una tabla nueva, esta prueba obliga a decidir si va en la exportación', () => {
    const tablas = (db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name").all() as { name: string }[]).map((t) => t.name)
    const exportadas = ['acta_reunion', 'alumno', 'asignacion_trimestral', 'calendario_trimestre', 'curso_academico', 'evaluacion_inicial', 'objetivo', 'opcion_catalogo', 'programa_intervencion', 'sesion', 'sesion_objetivo', 'trimestre']
    // Sin datos suyos: control interno, o tablas de los documentos retirados que siempre están vacías
    const internas = ['area', 'documento_generado', 'plantilla', 'secuencia_codigo', 'version_esquema']
    expect(tablas).toEqual([...exportadas, ...internas].sort())
    for (const vacia of ['area', 'documento_generado', 'plantilla']) {
      expect((db.prepare(`SELECT count(*) AS n FROM ${vacia}`).get() as { n: number }).n).toBe(0)
    }
  })

  it('se lee sin la aplicación: por alumno y curso, con sus palabras', () => {
    const datos = JSON.parse(baseCompleta().json) as DatosCompletos
    expect(datos).toMatchObject({ aplicacion: 'Ariadne', exportado: '2026-10-15' })
    expect(datos.alumnos.map((a) => a.nombre)).toEqual(['Ana', 'Lucía'])

    const lucia = datos.alumnos[1]
    expect(lucia).toMatchObject({ codigo: 'A-01', fechaNacimiento: '2018-03-04', diagnosticos: 'TEA', notas: 'Le gusta dibujar' })
    const [anterior, actual] = lucia.cursos
    expect(anterior).toMatchObject({
      curso: '2025/2026',
      estado: 'cerrado',
      evaluacionInicial: { fecha: '2025-09-20', instrumento: 'Observación', contenido: 'Lee con dificultad' },
      actas: [{ fecha: '2026-05-05', asistentes: 'Madre', contenido: 'Reunión de seguimiento', acuerdos: 'Leer en casa' }]
    })
    expect(anterior.programa!.objetivos[0].trimestres).toEqual([
      { trimestre: '3.er trimestre', valoracion: 'no conseguido', comentario: 'Silabea', vieneDe: null }
    ])
    expect(anterior.sesiones).toEqual([
      {
        fecha: '2026-04-10',
        trimestre: '3.er trimestre',
        noAcudio: false,
        estadoDelAlumno: ['Tranquilo', 'Cansado'],
        respuestaALasActividades: ['Participa'],
        objetivosTrabajados: ['Mejorar la fluidez lectora'],
        observaciones: 'Leyó el cuento',
        saludOMedicacion: null
      },
      expect.objectContaining({ fecha: '2026-04-17', noAcudio: true, estadoDelAlumno: [], observaciones: 'Enfermo' })
    ])
    expect(actual.continuaElCurso).toBe('2025/2026')
    expect(actual.programa!.objetivos[0].trimestres[0]).toMatchObject({
      valoracion: 'sin valorar',
      vieneDe: { curso: '2025/2026', trimestre: '3.er trimestre' }
    })
    expect(actual.trimestres[0]).toEqual({ trimestre: '1.er trimestre', inicio: '2026-09-10', fin: '2026-12-22', estado: 'abierto' })
    expect(datos.calendario.map((c) => c.curso)).toEqual(['2025/2026', '2026/2027'])
    expect(datos.opcionesDelRegistro.estadoDelAlumno[0]).toEqual({ texto: 'Tranquilo', activa: true })
  })

  it('va con sangrías, para leerlo, y con un LÉEME que explica cada fichero', () => {
    const r = baseCompleta()
    expect(r.json).toContain('\n  "aplicacion": "Ariadne",')
    expect(r.carpeta).toBe('Ariadne - todos los datos - 2026-10-15')
    expect(r.leeme).toContain('ariadne.sqlite')
    expect(r.leeme).toContain('ariadne-datos.json')
    expect(r.leeme).toContain('Son datos de menores')
    expect(r.leeme).toContain('Exportados el 15 de octubre de 2026.')
  })

  it('una base vacía también se exporta', () => {
    const datos = JSON.parse(exportacionCompleta(db, '2026-10-15').json) as DatosCompletos
    expect(datos.alumnos).toEqual([])
    expect(datos.opcionesDelRegistro.estadoDelAlumno.length).toBeGreaterThan(0)
  })
})
