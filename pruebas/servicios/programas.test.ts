import type Database from 'better-sqlite3'
import { beforeEach, describe, expect, it } from 'vitest'
import type { VistaCurso } from '../../src/compartido/ipc'
import { darDeAlta } from '../../src/main/servicios/alumnos'
import { anadirObjetivo, crearPrograma, editarContenido, editarObjetivo, moverObjetivo, programaDeCurso, quitarObjetivo } from '../../src/main/servicios/programas'
import { crearBaseDePrueba } from '../ayudas/baseDePrueba'
import { abrirCursoDePrueba } from '../ayudas/cursoDePrueba'

const HOY = '2026-09-27'

let db: Database.Database
let curso: VistaCurso

function nuevoCurso(nombre: string): VistaCurso {
  const alta = darDeAlta(db, { nombre, apellidos: 'García', fechaNacimiento: null, diagnosticos: null, notas: null }, true, HOY)
  if (alta.tipo !== 'creado') throw new Error('alta fallida')
  const abierto = abrirCursoDePrueba(db, alta.alumno.id, {
    curso: '2026/2027',
    nivelEducativo: null,
    periodos: [
      { numero: 1, fechaInicio: '2026-09-10', fechaFin: '2026-12-22' },
      { numero: 2, fechaInicio: '2027-01-08', fechaFin: '2027-03-26' },
      { numero: 3, fechaInicio: '2027-04-06', fechaFin: '2027-06-23' }
    ]
  })
  if (abierto.tipo !== 'guardado') throw new Error('apertura fallida')
  return abierto.curso
}

function trimestre(numero: 1 | 2 | 3, de = curso): number {
  return de.trimestres.find((t) => t.numero === numero)!.id
}

function programa(contenido: string | null = null) {
  const resultado = crearPrograma(db, curso.id, contenido, [], HOY)
  if (resultado.tipo !== 'guardado') throw new Error(`creación fallida: ${JSON.stringify(resultado)}`)
  return resultado.programa
}

beforeEach(() => {
  db = crearBaseDePrueba()
  curso = nuevoCurso('Lucía')
})

describe('programa de intervención', () => {
  it('se crea un programa, se añaden objetivos y cada uno queda en un trimestre sin valorar', () => {
    const creado = programa('Trabajar lectoescritura y atención.')
    anadirObjetivo(db, creado.id, { enunciado: 'Mejorar la fluidez lectora', trimestreId: trimestre(1) }, HOY)
    anadirObjetivo(db, creado.id, { enunciado: 'Mantener la atención 15 minutos', trimestreId: trimestre(2) }, HOY)

    const visto = programaDeCurso(db, curso.id)!
    expect(visto.contenido).toBe('Trabajar lectoescritura y atención.')
    expect(visto.asignaciones.map((a) => [a.enunciado, a.numeroTrimestre, a.valoracion, a.etiquetaValoracion, a.arrastrado])).toEqual([
      ['Mejorar la fluidez lectora', 1, 'sin_valorar', 'sin valorar', false],
      ['Mantener la atención 15 minutos', 2, 'sin_valorar', 'sin valorar', false]
    ])
  })

  it('un curso tiene un solo programa', () => {
    programa()
    expect(crearPrograma(db, curso.id, null, [], HOY)).toEqual({
      tipo: 'rechazado',
      mensaje: 'El curso 2026/2027 ya tiene programa de intervención.'
    })
  })

  it('el contenido general es opcional', () => {
    expect(programa().contenido).toBeNull()
  })

  it('la fecha de revisión se actualiza al cambiar el contenido o añadir un objetivo', () => {
    const creado = programa()
    expect(creado.fechaRevision).toBeNull()

    editarContenido(db, creado.id, 'Nuevo enfoque', '2026-10-05')
    expect(programaDeCurso(db, curso.id)!.fechaRevision).toBe('2026-10-05')

    anadirObjetivo(db, creado.id, { enunciado: 'Objetivo', trimestreId: trimestre(1) }, '2026-10-20')
    expect(programaDeCurso(db, curso.id)!.fechaRevision).toBe('2026-10-20')
  })
})

describe('añadir objetivos', () => {
  it('exige el enunciado', () => {
    const creado = programa()
    const resultado = anadirObjetivo(db, creado.id, { enunciado: '  ', trimestreId: trimestre(1) }, HOY)

    expect(resultado.tipo === 'invalido' && resultado.problemas.map((p) => p.campo)).toEqual(['enunciado'])
    expect(programaDeCurso(db, curso.id)!.asignaciones).toEqual([])
  })

  it('no admite un trimestre cerrado', () => {
    const creado = programa()
    db.prepare("UPDATE trimestre SET estado = 'cerrado' WHERE id = ?").run(trimestre(1))

    const resultado = anadirObjetivo(db, creado.id, { enunciado: 'Objetivo', trimestreId: trimestre(1) }, HOY)
    expect(resultado.tipo === 'invalido' && resultado.problemas[0].mensaje).toMatch(/está cerrado/)
  })

  it('no admite un trimestre de otro curso', () => {
    const creado = programa()
    const otro = nuevoCurso('Mario')

    const resultado = anadirObjetivo(db, creado.id, { enunciado: 'Objetivo', trimestreId: trimestre(1, otro) }, HOY)
    expect(resultado.tipo === 'invalido' && resultado.problemas[0].campo).toBe('trimestre')
  })

  it('se pueden planificar objetivos para trimestres futuros', () => {
    const creado = programa()
    expect(anadirObjetivo(db, creado.id, { enunciado: 'Objetivo', trimestreId: trimestre(3) }, HOY).tipo).toBe('guardado')
  })
})

describe('curso cerrado', () => {
  it('su programa se consulta, pero ya no cambia', () => {
    const creado = programa('Original')
    anadirObjetivo(db, creado.id, { enunciado: 'Objetivo', trimestreId: trimestre(1) }, HOY)
    db.prepare("UPDATE curso_academico SET estado = 'cerrado' WHERE id = ?").run(curso.id)

    const mensaje = 'El curso 2026/2027 está cerrado y su programa ya no cambia.'
    expect(editarContenido(db, creado.id, 'Cambiado', HOY)).toEqual({ tipo: 'rechazado', mensaje })
    expect(anadirObjetivo(db, creado.id, { enunciado: 'Otro', trimestreId: trimestre(2) }, HOY)).toEqual({ tipo: 'rechazado', mensaje })
    expect(programaDeCurso(db, curso.id)).toMatchObject({ contenido: 'Original' })
    expect(programaDeCurso(db, curso.id)!.asignaciones).toHaveLength(1)
  })

  it('en un curso cerrado no se crea programa', () => {
    db.prepare("UPDATE curso_academico SET estado = 'cerrado' WHERE id = ?").run(curso.id)
    expect(crearPrograma(db, curso.id, null, [], HOY).tipo).toBe('rechazado')
  })
})

describe('casos raros', () => {
  it('un curso o un programa que no existen se dicen claramente', () => {
    expect(crearPrograma(db, 999, null, [], HOY)).toEqual({ tipo: 'rechazado', mensaje: 'Este curso no existe.' })
    expect(anadirObjetivo(db, 999, { enunciado: 'x', trimestreId: 1 }, HOY)).toEqual({
      tipo: 'rechazado',
      mensaje: 'Este programa no existe.'
    })
    expect(programaDeCurso(db, 'uno')).toBeNull()
  })
})

describe('editar y mover objetivos (T3.3)', () => {
  function conObjetivo(enunciado = 'Mejorar la fluidez lectora', n: 1 | 2 | 3 = 1) {
    const creado = programa()
    const r = anadirObjetivo(db, creado.id, { enunciado, trimestreId: trimestre(n) }, HOY)
    if (r.tipo !== 'guardado') throw new Error('objetivo fallido')
    return { programaId: creado.id, asignacion: r.programa.asignaciones.find((a) => a.enunciado === enunciado)! }
  }

  /** Simula el arrastre al cerrar un trimestre, que llega en el Hito 5. */
  function arrastrarA(asignacionId: number, n: 1 | 2 | 3): number {
    const objetivo = (db.prepare('SELECT objetivo_id FROM asignacion_trimestral WHERE id = ?').get(asignacionId) as { objetivo_id: number }).objetivo_id
    return Number(
      db.prepare('INSERT INTO asignacion_trimestral (objetivo_id, trimestre_id, asignacion_anterior_id) VALUES (?, ?, ?)').run(objetivo, trimestre(n), asignacionId).lastInsertRowid
    )
  }

  it('editar el enunciado lo cambia en todos sus trimestres del curso y marca la revisión', () => {
    const { asignacion } = conObjetivo()
    db.prepare("UPDATE asignacion_trimestral SET valoracion = 'no_conseguido' WHERE id = ?").run(asignacion.asignacionId)
    db.prepare("UPDATE trimestre SET estado = 'cerrado' WHERE id = ?").run(trimestre(1))
    arrastrarA(asignacion.asignacionId, 2)

    const resultado = editarObjetivo(db, asignacion.objetivoId, 'Leer con fluidez textos cortos', '2026-11-03')

    expect(resultado.tipo === 'guardado' && resultado.programa.asignaciones.map((a) => [a.numeroTrimestre, a.enunciado])).toEqual([
      [1, 'Leer con fluidez textos cortos'],
      [2, 'Leer con fluidez textos cortos']
    ])
    expect(programaDeCurso(db, curso.id)!.fechaRevision).toBe('2026-11-03')
  })

  it('no admite un enunciado vacío', () => {
    const { asignacion } = conObjetivo()
    expect(editarObjetivo(db, asignacion.objetivoId, '  ', HOY).tipo).toBe('invalido')
  })

  it('mover lleva el objetivo a otro trimestre abierto', () => {
    const { asignacion } = conObjetivo()
    const resultado = moverObjetivo(db, asignacion.asignacionId, trimestre(3), HOY)

    expect(resultado.tipo === 'guardado' && resultado.programa.asignaciones.map((a) => [a.enunciado, a.numeroTrimestre])).toEqual([
      ['Mejorar la fluidez lectora', 3]
    ])
  })

  it('un objetivo ya valorado no se mueve: se trabajó en ese trimestre', () => {
    const { asignacion } = conObjetivo()
    db.prepare("UPDATE asignacion_trimestral SET valoracion = 'conseguido' WHERE id = ?").run(asignacion.asignacionId)

    expect(moverObjetivo(db, asignacion.asignacionId, trimestre(2), HOY).tipo).toBe('rechazado')
    expect(programaDeCurso(db, curso.id)!.asignaciones[0].puedeMoverse).toBe(false)
  })

  it('no se mueve a un trimestre cerrado', () => {
    const { asignacion } = conObjetivo('Objetivo', 2)
    db.prepare("UPDATE trimestre SET estado = 'cerrado' WHERE id = ?").run(trimestre(1))

    const resultado = moverObjetivo(db, asignacion.asignacionId, trimestre(1), HOY)
    expect(resultado.tipo === 'invalido' && resultado.problemas[0].mensaje).toMatch(/está cerrado/)
  })

  it('un objetivo arrastrado solo se mueve hacia delante, para no romper la cadena', () => {
    const { asignacion } = conObjetivo()
    db.prepare("UPDATE asignacion_trimestral SET valoracion = 'no_conseguido' WHERE id = ?").run(asignacion.asignacionId)
    const enElSegundo = arrastrarA(asignacion.asignacionId, 2)

    expect(moverObjetivo(db, enElSegundo, trimestre(1), HOY).tipo).toBe('invalido')
    expect(moverObjetivo(db, enElSegundo, trimestre(3), HOY).tipo).toBe('guardado')

    const anterior = db.prepare('SELECT asignacion_anterior_id AS a FROM asignacion_trimestral WHERE id = ?').get(enElSegundo) as { a: number }
    expect(anterior.a).toBe(asignacion.asignacionId)
  })

  it('el trimestre que ya tiene continuación no se mueve', () => {
    const { asignacion } = conObjetivo()
    arrastrarA(asignacion.asignacionId, 2)
    expect(moverObjetivo(db, asignacion.asignacionId, trimestre(3), HOY)).toEqual({ tipo: 'rechazado', mensaje: 'Ya continúa en otro trimestre.' })
  })

  it('quitar un objetivo puesto por error lo borra del programa', () => {
    const { asignacion } = conObjetivo()
    const resultado = quitarObjetivo(db, asignacion.objetivoId, HOY)

    expect(resultado.tipo === 'guardado' && resultado.programa.asignaciones).toEqual([])
    expect(db.prepare('SELECT COUNT(*) AS n FROM objetivo').get()).toEqual({ n: 0 })
  })

  it('no se quita un objetivo valorado, con historia o con sesiones', () => {
    const valorado = conObjetivo('Valorado').asignacion
    db.prepare("UPDATE asignacion_trimestral SET valoracion = 'conseguido' WHERE id = ?").run(valorado.asignacionId)
    expect(quitarObjetivo(db, valorado.objetivoId, HOY)).toEqual({ tipo: 'rechazado', mensaje: 'Ya está valorado.' })

    const conHistoria = anadirObjetivo(db, programaDeCurso(db, curso.id)!.id, { enunciado: 'Con historia', trimestreId: trimestre(1) }, HOY)
    if (conHistoria.tipo !== 'guardado') throw new Error()
    const historia = conHistoria.programa.asignaciones.find((a) => a.enunciado === 'Con historia')!
    arrastrarA(historia.asignacionId, 2)
    expect(quitarObjetivo(db, historia.objetivoId, HOY).tipo).toBe('rechazado')

    const conSesion = anadirObjetivo(db, programaDeCurso(db, curso.id)!.id, { enunciado: 'Con sesión', trimestreId: trimestre(1) }, HOY)
    if (conSesion.tipo !== 'guardado') throw new Error()
    const sesionado = conSesion.programa.asignaciones.find((a) => a.enunciado === 'Con sesión')!
    const sesion = db.prepare("INSERT INTO sesion (alumno_id, trimestre_id, fecha) VALUES (?, ?, '2026-10-01')").run(curso.alumnoId, trimestre(1))
    db.prepare('INSERT INTO sesion_objetivo (sesion_id, objetivo_id) VALUES (?, ?)').run(sesion.lastInsertRowid, sesionado.objetivoId)
    expect(quitarObjetivo(db, sesionado.objetivoId, HOY)).toEqual({ tipo: 'rechazado', mensaje: 'Tiene sesiones asociadas.' })
  })

  it('en un curso cerrado no se edita, ni se mueve, ni se quita', () => {
    const { asignacion } = conObjetivo()
    db.prepare("UPDATE curso_academico SET estado = 'cerrado' WHERE id = ?").run(curso.id)
    const mensaje = 'El curso 2026/2027 está cerrado y su programa ya no cambia.'

    expect(editarObjetivo(db, asignacion.objetivoId, 'Otro', HOY)).toEqual({ tipo: 'rechazado', mensaje })
    expect(moverObjetivo(db, asignacion.asignacionId, trimestre(2), HOY)).toEqual({ tipo: 'rechazado', mensaje })
    expect(quitarObjetivo(db, asignacion.objetivoId, HOY)).toEqual({ tipo: 'rechazado', mensaje })
  })
})
