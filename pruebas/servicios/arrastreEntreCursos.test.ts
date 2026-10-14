import type Database from 'better-sqlite3'
import { beforeEach, describe, expect, it } from 'vitest'
import type { VistaCurso } from '../../src/compartido/ipc'
import { estaCompleta, recorrerCadena } from '../../src/main/dominio/arrastre'
import type { Valoracion } from '../../src/main/dominio/vocabulario'
import { darDeAlta } from '../../src/main/servicios/alumnos'
import { anadirObjetivo, crearPrograma, pendientesDelCursoAnterior, programaDeCurso } from '../../src/main/servicios/programas'
import { crearBaseDePrueba } from '../ayudas/baseDePrueba'
import { abrirCursoDePrueba } from '../ayudas/cursoDePrueba'

const HOY = '2026-09-27'

let db: Database.Database
let alumnoId: number

function abrir(curso: string): VistaCurso {
  const [a, b] = curso.split('/')
  const resultado = abrirCursoDePrueba(db, alumnoId, {
    curso,
    nivelEducativo: null,
    periodos: [
      { numero: 1, fechaInicio: `${a}-09-10`, fechaFin: `${a}-12-22` },
      { numero: 2, fechaInicio: `${b}-01-08`, fechaFin: `${b}-03-26` },
      { numero: 3, fechaInicio: `${b}-04-06`, fechaFin: `${b}-06-23` }
    ]
  })
  if (resultado.tipo !== 'guardado') throw new Error('apertura fallida')
  return resultado.curso
}

const trimestre = (curso: VistaCurso, n: 1 | 2 | 3) => curso.trimestres.find((t) => t.numero === n)!.id

function valorar(asignacionId: number, valoracion: Valoracion) {
  db.prepare('UPDATE asignacion_trimestral SET valoracion = ? WHERE id = ?').run(valoracion, asignacionId)
}

/** Hasta el Hito 5 no existe el arrastre al cerrar trimestre: aquí se simula como lo hará. */
function arrastrar(asignacionId: number, trimestreId: number, valoracion: Valoracion): number {
  const objetivo = (db.prepare('SELECT objetivo_id FROM asignacion_trimestral WHERE id = ?').get(asignacionId) as { objetivo_id: number })
    .objetivo_id
  return Number(
    db
      .prepare('INSERT INTO asignacion_trimestral (objetivo_id, trimestre_id, valoracion, asignacion_anterior_id) VALUES (?, ?, ?, ?)')
      .run(objetivo, trimestreId, valoracion, asignacionId).lastInsertRowid
  )
}

function cerrarCurso(curso: VistaCurso) {
  db.prepare("UPDATE trimestre SET estado = 'cerrado' WHERE curso_academico_id = ?").run(curso.id)
  db.prepare("UPDATE curso_academico SET estado = 'cerrado' WHERE id = ?").run(curso.id)
}

function todasLasAsignaciones() {
  return db
    .prepare('SELECT id, trimestre_id AS trimestreId, valoracion, asignacion_anterior_id AS asignacionAnteriorId FROM asignacion_trimestral')
    .all() as { id: number; trimestreId: number; valoracion: Valoracion; asignacionAnteriorId: number | null }[]
}

let anterior: VistaCurso
let fluidezFinal: number
let atencion: number
let conseguido: number
let dejadoCaer: number

beforeEach(() => {
  db = crearBaseDePrueba()
  const alta = darDeAlta(db, { nombre: 'Lucía', apellidos: 'García', fechaNacimiento: null, diagnosticos: null, notas: null }, false, HOY)
  if (alta.tipo !== 'creado') throw new Error('alta fallida')
  alumnoId = alta.alumno.id

  // Curso 2025/2026: un objetivo arrastrado todo el año, uno sin abordar al final, uno conseguido y uno que se dejó caer
  anterior = abrir('2025/2026')
  const programa = crearPrograma(db, anterior.id, null, [], '2025-09-20')
  if (programa.tipo !== 'guardado') throw new Error('programa fallido')
  const id = (enunciado: string, n: 1 | 2 | 3) => {
    const r = anadirObjetivo(db, programa.programa.id, { enunciado, trimestreId: trimestre(anterior, n) }, '2025-09-20')
    if (r.tipo !== 'guardado') throw new Error('objetivo fallido')
    return r.programa.asignaciones.find((a) => a.enunciado === enunciado)!.asignacionId
  }
  const fluidez = id('Mejorar la fluidez lectora', 1)
  atencion = id('Mantener la atención 15 minutos', 3)
  conseguido = id('Reconocer las vocales', 3)
  dejadoCaer = id('Escribir su nombre', 2)

  valorar(fluidez, 'no_conseguido')
  const fluidez2 = arrastrar(fluidez, trimestre(anterior, 2), 'no_conseguido')
  fluidezFinal = arrastrar(fluidez2, trimestre(anterior, 3), 'no_conseguido')
  valorar(atencion, 'pendiente_desarrollar')
  valorar(conseguido, 'conseguido')
  valorar(dejadoCaer, 'no_conseguido')
  cerrarCurso(anterior)
})

describe('partir del curso anterior', () => {
  it('al abrir el curso nuevo se listan los objetivos que acabaron pendientes', () => {
    const nuevo = abrir('2026/2027')

    expect(pendientesDelCursoAnterior(db, nuevo.id)).toEqual({
      curso: '2025/2026',
      // En el orden en que se crearon los objetivos en el curso anterior
      objetivos: [
        { asignacionId: fluidezFinal, enunciado: 'Mejorar la fluidez lectora', valoracion: 'no_conseguido', etiquetaValoracion: 'no conseguido' },
        { asignacionId: atencion, enunciado: 'Mantener la atención 15 minutos', valoracion: 'pendiente_desarrollar', etiquetaValoracion: 'pendiente de desarrollar' }
      ]
    })
  })

  it('los elegidos aparecen como objetivos del curso nuevo, en el 1.er trimestre y marcados como arrastrados', () => {
    const nuevo = abrir('2026/2027')
    const resultado = crearPrograma(db, nuevo.id, null, [fluidezFinal, atencion], HOY)

    expect(resultado.tipo === 'guardado' && resultado.programa.asignaciones.map((a) => [a.enunciado, a.numeroTrimestre, a.valoracion, a.arrastrado])).toEqual(
      expect.arrayContaining([
        ['Mejorar la fluidez lectora', 1, 'sin_valorar', true],
        ['Mantener la atención 15 minutos', 1, 'sin_valorar', true]
      ])
    )
  })

  it('la cadena cruza el salto de curso sin romperse', () => {
    const nuevo = abrir('2026/2027')
    crearPrograma(db, nuevo.id, null, [fluidezFinal], HOY)
    const continuada = programaDeCurso(db, nuevo.id)!.asignaciones[0].asignacionId

    const cadena = recorrerCadena(todasLasAsignaciones(), continuada)

    expect(cadena).toHaveLength(4)
    expect(cadena.map((e) => e.valoracion)).toEqual(['no_conseguido', 'no_conseguido', 'no_conseguido', 'sin_valorar'])
    expect(estaCompleta(cadena)).toBe(true)
  })

  it('reformular el objetivo en el curso nuevo no altera el del curso anterior', () => {
    const nuevo = abrir('2026/2027')
    crearPrograma(db, nuevo.id, null, [fluidezFinal], HOY)
    const objetivoNuevo = programaDeCurso(db, nuevo.id)!.asignaciones[0].objetivoId

    db.prepare('UPDATE objetivo SET enunciado = ? WHERE id = ?').run('Leer con fluidez textos de una página', objetivoNuevo)

    expect(programaDeCurso(db, anterior.id)!.asignaciones.map((a) => a.enunciado)).toContain('Mejorar la fluidez lectora')
    expect(programaDeCurso(db, nuevo.id)!.asignaciones[0].enunciado).toBe('Leer con fluidez textos de una página')
  })

  it('solo se traen los que ella marca', () => {
    const nuevo = abrir('2026/2027')
    crearPrograma(db, nuevo.id, null, [atencion], HOY)

    expect(programaDeCurso(db, nuevo.id)!.asignaciones.map((a) => a.enunciado)).toEqual(['Mantener la atención 15 minutos'])
  })

  it('no se puede traer algo que no estaba pendiente', () => {
    const nuevo = abrir('2026/2027')

    for (const intruso of [conseguido, dejadoCaer]) {
      expect(crearPrograma(db, nuevo.id, null, [intruso], HOY)).toEqual({
        tipo: 'rechazado',
        mensaje: 'Alguno de los objetivos elegidos no está pendiente del curso anterior.'
      })
    }
    expect(programaDeCurso(db, nuevo.id)).toBeNull()
  })

  it('sin curso anterior no hay nada que ofrecer', () => {
    db = crearBaseDePrueba()
    const alta = darDeAlta(db, { nombre: 'Mario', apellidos: 'Ruiz', fechaNacimiento: null, diagnosticos: null, notas: null }, false, HOY)
    if (alta.tipo !== 'creado') throw new Error('alta fallida')
    alumnoId = alta.alumno.id

    expect(pendientesDelCursoAnterior(db, abrir('2026/2027').id)).toBeNull()
  })
})
