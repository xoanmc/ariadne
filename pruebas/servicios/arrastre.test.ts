import type Database from 'better-sqlite3'
import { beforeEach, describe, expect, it } from 'vitest'
import type { VistaCurso } from '../../src/compartido/ipc'
import { estaCompleta } from '../../src/main/dominio/arrastre'
import type { Trimestre } from '../../src/main/dominio/entidades'
import { obtenerTrimestre } from '../../src/main/persistencia/repositorioCursos'
import { darDeAlta } from '../../src/main/servicios/alumnos'
import { arrastrarAlSiguiente, cadenaDeObjetivo, valorarObjetivo } from '../../src/main/servicios/cierre'
import { abrirCurso } from '../../src/main/servicios/cursos'
import { anadirObjetivo, crearPrograma, pendientesDelCursoAnterior, programaDeCurso } from '../../src/main/servicios/programas'
import { crearBaseDePrueba } from '../ayudas/baseDePrueba'

const HOY = '2026-10-14'

let db: Database.Database
let alumnoId: number
let curso: VistaCurso

function abrir(nombre: string): VistaCurso {
  const [a, b] = nombre.split('/')
  const r = abrirCurso(db, alumnoId, {
    curso: nombre,
    nivelEducativo: null,
    periodos: [
      { numero: 1, fechaInicio: `${a}-09-10`, fechaFin: `${a}-12-22` },
      { numero: 2, fechaInicio: `${b}-01-08`, fechaFin: `${b}-03-26` },
      { numero: 3, fechaInicio: `${b}-04-06`, fechaFin: `${b}-06-23` }
    ]
  })
  if (r.tipo !== 'guardado') throw new Error('apertura fallida')
  return r.curso
}

const trimestre = (n: 1 | 2 | 3, de = curso): Trimestre => obtenerTrimestre(db, de.trimestres.find((t) => t.numero === n)!.id)!

/** Hasta T5.4 el cierre se simula: aquí solo importa que el trimestre quede cerrado. */
const cerrar = (t: Trimestre) => db.prepare("UPDATE trimestre SET estado = 'cerrado' WHERE id = ?").run(t.id)

function objetivo(enunciado: string, n: 1 | 2 | 3 = 1): number {
  const programa = programaDeCurso(db, curso.id) ?? (() => {
    const r = crearPrograma(db, curso.id, null, [], HOY)
    if (r.tipo !== 'guardado') throw new Error('programa fallido')
    return programaDeCurso(db, curso.id)!
  })()
  const r = anadirObjetivo(db, programa.id, { enunciado, trimestreId: trimestre(n).id }, HOY)
  if (r.tipo !== 'guardado') throw new Error('objetivo fallido')
  return r.programa.asignaciones.find((a) => a.enunciado === enunciado)!.asignacionId
}

function arrastrar(t: Trimestre, ids: number[]): number[] {
  const r = arrastrarAlSiguiente(db, t, ids)
  if (r.tipo !== 'arrastrados') throw new Error(r.mensaje)
  return r.asignaciones
}

beforeEach(() => {
  db = crearBaseDePrueba()
  const alta = darDeAlta(db, { nombre: 'Lucía', apellidos: 'García', fechaNacimiento: null, diagnosticos: null, notas: null }, false, HOY)
  if (alta.tipo !== 'creado') throw new Error('alta fallida')
  alumnoId = alta.alumno.id
  curso = abrir('2026/2027')
})

describe('arrastre al trimestre siguiente (T5.3)', () => {
  it('un objetivo arrastrado tres trimestres se recorre hacia atrás con su cadena completa', () => {
    const t1 = objetivo('Mejorar la fluidez lectora')
    valorarObjetivo(db, t1, 'no_conseguido', 'Silabea')
    const [t2] = arrastrar(trimestre(1), [t1])
    cerrar(trimestre(1))
    valorarObjetivo(db, t2, 'pendiente_desarrollar', null)
    const [t3] = arrastrar(trimestre(2), [t2])
    cerrar(trimestre(2))

    const cadena = cadenaDeObjetivo(db, t3)
    expect(cadena.map((e) => [e.numeroTrimestre, e.valoracion])).toEqual([
      [1, 'no_conseguido'],
      [2, 'pendiente_desarrollar'],
      [3, 'sin_valorar']
    ])
    expect(estaCompleta(cadena)).toBe(true)
  })

  it('lo arrastrado aparece en el trimestre siguiente sin valorar, sin comentario y marcado como arrastrado', () => {
    const id = objetivo('Mantener la atención')
    valorarObjetivo(db, id, 'pendiente_desarrollar', 'No dio tiempo')
    arrastrar(trimestre(1), [id])

    const enElSegundo = programaDeCurso(db, curso.id)!.asignaciones.filter((a) => a.numeroTrimestre === 2)
    expect(enElSegundo).toEqual([
      expect.objectContaining({ enunciado: 'Mantener la atención', valoracion: 'sin_valorar', comentario: null, arrastrado: true })
    ])
  })

  it('la cadena sigue al cruzar de curso, hasta el objetivo de partida', () => {
    const t1 = objetivo('Mejorar la fluidez lectora')
    valorarObjetivo(db, t1, 'no_conseguido', null)
    const [t2] = arrastrar(trimestre(1), [t1])
    valorarObjetivo(db, t2, 'no_conseguido', null)
    const [t3] = arrastrar(trimestre(2), [t2])
    valorarObjetivo(db, t3, 'pendiente_desarrollar', null)
    db.prepare("UPDATE trimestre SET estado = 'cerrado' WHERE curso_academico_id = ?").run(curso.id)
    db.prepare("UPDATE curso_academico SET estado = 'cerrado' WHERE id = ?").run(curso.id)

    const anterior = curso
    curso = abrir('2027/2028')
    const pendiente = pendientesDelCursoAnterior(db, curso.id)!.objetivos[0].asignacionId
    crearPrograma(db, curso.id, null, [pendiente], HOY)
    const nueva = programaDeCurso(db, curso.id)!.asignaciones[0].asignacionId

    const cadena = cadenaDeObjetivo(db, nueva)
    expect(cadena.map((e) => [e.curso, e.numeroTrimestre])).toEqual([
      [anterior.curso, 1],
      [anterior.curso, 2],
      [anterior.curso, 3],
      ['2027/2028', 1]
    ])
    expect(estaCompleta(cadena)).toBe(true)
  })

  it('solo se arrastra lo no conseguido o pendiente de desarrollar', () => {
    const conseguido = objetivo('Reconocer las vocales')
    valorarObjetivo(db, conseguido, 'conseguido', null)
    const sinValorar = objetivo('Escribir su nombre')

    for (const id of [conseguido, sinValorar]) {
      expect(arrastrarAlSiguiente(db, trimestre(1), [id])).toEqual({
        tipo: 'rechazado',
        mensaje: 'Solo pasan al trimestre siguiente los objetivos no conseguidos o pendientes de desarrollar.'
      })
    }
  })

  it('del 3.er trimestre no se arrastra a ningún sitio: eso lo hace el curso siguiente', () => {
    const id = objetivo('Leer frases cortas', 3)
    valorarObjetivo(db, id, 'no_conseguido', null)
    expect(arrastrarAlSiguiente(db, trimestre(3), [id])).toEqual({
      tipo: 'rechazado',
      mensaje: 'Lo pendiente del 3.er trimestre pasa al curso siguiente al abrirlo, no a otro trimestre.'
    })
  })

  it('no se arrastra a un trimestre ya cerrado, ni dos veces lo mismo, ni lo de otro trimestre', () => {
    const id = objetivo('Mejorar la fluidez lectora')
    valorarObjetivo(db, id, 'no_conseguido', null)
    const delSegundo = objetivo('Contar hasta veinte', 2)
    valorarObjetivo(db, delSegundo, 'no_conseguido', null)

    expect(arrastrarAlSiguiente(db, trimestre(1), [delSegundo])).toMatchObject({ tipo: 'rechazado' })
    arrastrar(trimestre(1), [id])
    expect(arrastrarAlSiguiente(db, trimestre(1), [id])).toEqual({
      tipo: 'rechazado',
      mensaje: 'Alguno de los objetivos elegidos ya pasó al trimestre siguiente.'
    })
    cerrar(trimestre(2))
    expect(arrastrarAlSiguiente(db, trimestre(1), [delSegundo])).toEqual({
      tipo: 'rechazado',
      mensaje: 'El 2.º trimestre ya está cerrado: no se le pueden pasar objetivos.'
    })
  })

  it('si uno de los elegidos no vale, no se arrastra ninguno', () => {
    const bueno = objetivo('Mejorar la fluidez lectora')
    valorarObjetivo(db, bueno, 'no_conseguido', null)
    const malo = objetivo('Reconocer las vocales')
    valorarObjetivo(db, malo, 'conseguido', null)

    expect(arrastrarAlSiguiente(db, trimestre(1), [bueno, malo]).tipo).toBe('rechazado')
    expect(programaDeCurso(db, curso.id)!.asignaciones.filter((a) => a.numeroTrimestre === 2)).toEqual([])
  })

  it('sin nada elegido no se arrastra nada', () => {
    expect(arrastrarAlSiguiente(db, trimestre(1), [])).toEqual({ tipo: 'arrastrados', asignaciones: [] })
  })
})
