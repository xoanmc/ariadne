import type Database from 'better-sqlite3'
import { beforeEach, describe, expect, it } from 'vitest'
import type { DatosCurso, PeriodoTrimestre } from '../../src/compartido/ipc'
import { darDeAlta } from '../../src/main/servicios/alumnos'
import { guardarCalendario } from '../../src/main/servicios/calendario'
import { abrirCurso, corregirCurso, cursosDeAlumno, obtenerCurso, proponerCurso } from '../../src/main/servicios/cursos'
import { crearBaseDePrueba } from '../ayudas/baseDePrueba'
import { abrirCursoDePrueba } from '../ayudas/cursoDePrueba'

const HOY = '2026-09-27'

let db: Database.Database
let alumnoId: number

function periodos(curso: string): PeriodoTrimestre[] {
  const [a, b] = curso.split('/')
  return [
    { numero: 1, fechaInicio: `${a}-09-10`, fechaFin: `${a}-12-22` },
    { numero: 2, fechaInicio: `${b}-01-08`, fechaFin: `${b}-03-26` },
    { numero: 3, fechaInicio: `${b}-04-06`, fechaFin: `${b}-06-23` }
  ]
}

function datos(curso: string, extra: Partial<DatosCurso> = {}): DatosCurso {
  return { curso, nivelEducativo: null, ...extra }
}

function abrir(curso: string, extra: Partial<DatosCurso> = {}) {
  const resultado = abrirCursoDePrueba(db, alumnoId, { ...datos(curso, extra), periodos: periodos(curso) })
  if (resultado.tipo !== 'guardado') throw new Error(`apertura fallida: ${JSON.stringify(resultado)}`)
  return resultado.curso
}

/** Hasta el Hito 5 no existe el cierre de trimestre: en las pruebas se cierra a mano. */
function cerrar(cursoId: number) {
  db.prepare("UPDATE trimestre SET estado = 'cerrado' WHERE curso_academico_id = ?").run(cursoId)
  db.prepare("UPDATE curso_academico SET estado = 'cerrado' WHERE id = ?").run(cursoId)
}

beforeEach(() => {
  db = crearBaseDePrueba()
  const alta = darDeAlta(db, { nombre: 'Lucía', apellidos: 'García', fechaNacimiento: null, diagnosticos: null, notas: null }, false, HOY)
  if (alta.tipo !== 'creado') throw new Error('alta fallida')
  alumnoId = alta.alumno.id
})

describe('apertura de curso', () => {
  it('crea el curso con sus tres trimestres y las fechas del calendario escolar', () => {
    const curso = abrir('2026/2027', { nivelEducativo: '3.º de Primaria' })

    expect(curso).toMatchObject({
      curso: '2026/2027',
      nivelEducativo: '3.º de Primaria',
      estado: 'activo',
      cursoAnterior: null
    })
    expect(curso.trimestres.map(({ numero, fechaInicio, fechaFin, estado }) => ({ numero, fechaInicio, fechaFin, estado }))).toEqual(
      periodos('2026/2027').map((p) => ({ ...p, estado: 'abierto' }))
    )
  })

  it('sin calendario de ese curso escolar, lo fija con las fechas propuestas', () => {
    const r = abrirCurso(db, alumnoId, datos('2027/2028'))
    expect(r.tipo === 'guardado' && r.curso.trimestres[0]).toMatchObject({ fechaInicio: '2027-09-01', fechaFin: '2027-12-31' })
    expect(db.prepare("SELECT count(*) AS n FROM calendario_trimestre WHERE curso = '2027/2028'").get()).toEqual({ n: 3 })
  })

  it('un curso mal escrito no se abre', () => {
    expect(abrirCurso(db, alumnoId, datos('2026/2028')).tipo).toBe('invalido')
    expect(cursosDeAlumno(db, alumnoId)).toEqual([])
  })

  it('a un alumno que no existe no se le abre curso', () => {
    expect(abrirCurso(db, 999, datos('2026/2027'))).toEqual({ tipo: 'rechazado', mensaje: 'Este alumno no existe.' })
  })
})

describe('un solo curso activo por alumno', () => {
  it('no deja abrir otro mientras el actual siga activo', () => {
    abrir('2026/2027')
    const resultado = abrirCurso(db, alumnoId, datos('2027/2028'))

    expect(resultado.tipo).toBe('rechazado')
    expect(resultado.tipo === 'rechazado' && resultado.mensaje).toMatch(/cierra antes su tercer trimestre/)
  })

  it('la propia base de datos lo impide aunque se intente por fuera de la aplicación', () => {
    abrir('2026/2027')
    expect(() =>
      db.prepare("INSERT INTO curso_academico (alumno_id, curso) VALUES (?, '2027/2028')").run(alumnoId)
    ).toThrow(/UNIQUE constraint failed/)
  })

  it('otro alumno sí puede tener su propio curso activo', () => {
    abrir('2026/2027')
    const otro = darDeAlta(db, { nombre: 'Mario', apellidos: 'Ruiz', fechaNacimiento: null, diagnosticos: null, notas: null }, false, HOY)
    if (otro.tipo !== 'creado') throw new Error('alta fallida')

    expect(abrirCurso(db, otro.alumno.id, datos('2026/2027')).tipo).toBe('guardado')
  })
})

describe('enlace con el curso anterior', () => {
  it('el curso nuevo queda enlazado con el anterior', () => {
    const anterior = abrir('2025/2026')
    cerrar(anterior.id)

    expect(abrir('2026/2027').cursoAnterior).toBe('2025/2026')
  })

  it('se enlaza con el más reciente aunque haya un año sin intervención de por medio', () => {
    const anterior = abrir('2024/2025')
    cerrar(anterior.id)

    expect(abrir('2026/2027').cursoAnterior).toBe('2024/2025')
  })

  it('no se puede abrir un curso anterior al último que tiene', () => {
    cerrar(abrir('2025/2026').id)
    const resultado = abrirCurso(db, alumnoId, datos('2024/2025'))

    expect(resultado).toEqual({
      tipo: 'rechazado',
      mensaje: 'Solo se puede abrir un curso posterior al último que tiene, 2025/2026.'
    })
  })

  it('no se puede abrir dos veces el mismo curso', () => {
    cerrar(abrir('2026/2027').id)
    expect(abrirCurso(db, alumnoId, datos('2026/2027'))).toEqual({
      tipo: 'rechazado',
      mensaje: 'El curso 2026/2027 ya existe para este alumno.'
    })
  })
})

describe('propuesta al abrir', () => {
  it('propone el curso que toca con fechas en meses completos', () => {
    expect(proponerCurso(db, alumnoId, undefined, HOY)).toEqual({
      tipo: 'propuesta',
      curso: '2026/2027',
      cursoAnterior: null,
      calendarioFijado: false,
      periodos: [
        { numero: 1, fechaInicio: '2026-09-01', fechaFin: '2026-12-31' },
        { numero: 2, fechaInicio: '2027-01-01', fechaFin: '2027-03-31' },
        { numero: 3, fechaInicio: '2027-04-01', fechaFin: '2027-06-30' }
      ]
    })
  })

  it('si ese curso ya existe, propone el siguiente al último', () => {
    cerrar(abrir('2026/2027').id)
    const propuesta = proponerCurso(db, alumnoId, undefined, HOY)
    expect(propuesta.tipo === 'propuesta' && [propuesta.curso, propuesta.cursoAnterior]).toEqual(['2027/2028', '2026/2027'])
  })

  it('si el calendario de ese curso ya está fijado, propone sus fechas', () => {
    guardarCalendario(db, '2026/2027', periodos('2026/2027'))
    expect(proponerCurso(db, alumnoId, undefined, HOY)).toMatchObject({ calendarioFijado: true, periodos: periodos('2026/2027') })
  })

  it('si pide otro curso, propone las fechas de ese curso', () => {
    const propuesta = proponerCurso(db, alumnoId, '2027/2028', HOY)
    expect(propuesta.tipo === 'propuesta' && propuesta.periodos[0].fechaInicio).toBe('2027-09-01')
  })

  it('con un curso activo, dice cuál es en lugar de proponer otro', () => {
    abrir('2026/2027')
    expect(proponerCurso(db, alumnoId, undefined, HOY)).toEqual({ tipo: 'curso_activo', curso: '2026/2027' })
  })
})

describe('corregir un curso', () => {
  it('corrige el nivel, pero no el curso ni las fechas, que son las del calendario', () => {
    const curso = abrir('2026/2027')
    const resultado = corregirCurso(db, curso.id, { nivelEducativo: '4.º de Primaria' })

    expect(resultado.tipo === 'guardado' && resultado.curso).toMatchObject({
      curso: '2026/2027',
      nivelEducativo: '4.º de Primaria',
      trimestres: expect.arrayContaining([expect.objectContaining({ numero: 1, fechaInicio: '2026-09-10' })])
    })
  })
})

describe('lista de cursos del alumno', () => {
  it('del más reciente al más antiguo', () => {
    cerrar(abrir('2024/2025').id)
    cerrar(abrir('2025/2026').id)
    abrir('2026/2027')

    expect(cursosDeAlumno(db, alumnoId).map((c) => `${c.curso} ${c.estado}`)).toEqual([
      '2026/2027 activo',
      '2025/2026 cerrado',
      '2024/2025 cerrado'
    ])
  })
})

describe('historial del alumno', () => {
  it('un alumno con tres cursos los muestra los tres en orden, cada uno enlazado con el anterior', () => {
    cerrar(abrir('2024/2025').id)
    cerrar(abrir('2025/2026').id)
    abrir('2026/2027')

    expect(cursosDeAlumno(db, alumnoId).map((c) => [c.curso, c.estado, c.cursoAnterior])).toEqual([
      ['2026/2027', 'activo', '2025/2026'],
      ['2025/2026', 'cerrado', '2024/2025'],
      ['2024/2025', 'cerrado', null]
    ])
  })

  it('se puede entrar en cualquiera de sus cursos, también en los cerrados', () => {
    const antiguo = abrir('2025/2026')
    cerrar(antiguo.id)

    expect(obtenerCurso(db, antiguo.id)).toMatchObject({ alumnoId, curso: '2025/2026', estado: 'cerrado' })
    expect(obtenerCurso(db, antiguo.id)?.trimestres).toHaveLength(3)
  })

  it('un curso que no existe se dice claramente', () => {
    expect(obtenerCurso(db, 999)).toBeNull()
    expect(obtenerCurso(db, 'uno')).toBeNull()
  })

  it('un curso cerrado se consulta, pero ya no se corrige', () => {
    const curso = abrir('2025/2026', { nivelEducativo: '2.º de Primaria' })
    cerrar(curso.id)

    expect(corregirCurso(db, curso.id, datos('2025/2026', { nivelEducativo: '3.º de Primaria' }))).toEqual({
      tipo: 'rechazado',
      mensaje: 'El curso 2025/2026 está cerrado y ya no se modifica.'
    })
    expect(obtenerCurso(db, curso.id)?.nivelEducativo).toBe('2.º de Primaria')
  })
})

describe('trimestre en curso del curso', () => {
  it('la vista del curso dice cuál es por la fecha de hoy', () => {
    const curso = abrir('2026/2027')
    const segundo = curso.trimestres.find((t) => t.numero === 2)!.id
    expect(obtenerCurso(db, curso.id, '2027-02-01')?.trimestreEnCursoId).toBe(segundo)
  })

  it('un curso cerrado no tiene trimestre en curso', () => {
    const curso = abrir('2025/2026')
    cerrar(curso.id)
    expect(obtenerCurso(db, curso.id, '2026-02-01')?.trimestreEnCursoId).toBeNull()
  })
})
