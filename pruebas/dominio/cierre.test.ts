import { describe, expect, it } from 'vitest'
import {
  arrastrables,
  elCierreCierraElCurso,
  incoherenciaDe,
  puedeCerrarseTrimestre,
  sinValorar,
  trimestreSiguiente,
  verificarTrimestre,
  type ObjetivoEnVerificacion,
  type ObjetivoValorado
} from '../../src/main/dominio/cierre'
import type { Valoracion } from '../../src/main/dominio/vocabulario'

function objetivo(id: number, valoracion: Valoracion): ObjetivoValorado {
  return { asignacionId: id, objetivoId: id * 100, valoracion }
}

describe('cierre de trimestre', () => {
  it('no deja cerrar mientras quede algo sin valorar', () => {
    const trimestre = [objetivo(1, 'conseguido'), objetivo(2, 'sin_valorar')]

    expect(puedeCerrarseTrimestre(trimestre)).toBe(false)
    expect(sinValorar(trimestre).map((o) => o.asignacionId)).toEqual([2])
  })

  it('deja cerrar cuando todo está valorado, sea cual sea el resultado', () => {
    const trimestre = [
      objetivo(1, 'conseguido'),
      objetivo(2, 'no_conseguido'),
      objetivo(3, 'pendiente_desarrollar')
    ]
    expect(puedeCerrarseTrimestre(trimestre)).toBe(true)
  })

  it('un trimestre sin objetivos puede cerrarse', () => {
    expect(puedeCerrarseTrimestre([])).toBe(true)
  })
})

describe('qué pasa al trimestre siguiente', () => {
  it('se arrastra lo no conseguido y lo que no llegó a abordarse', () => {
    const trimestre = [
      objetivo(1, 'conseguido'),
      objetivo(2, 'no_conseguido'),
      objetivo(3, 'pendiente_desarrollar'),
      objetivo(4, 'sin_valorar')
    ]

    expect(arrastrables(trimestre).map((o) => o.asignacionId)).toEqual([2, 3])
  })
})

describe('cierre de curso', () => {
  it('cerrar el tercer trimestre cierra el curso, los otros no', () => {
    expect(elCierreCierraElCurso(1)).toBe(false)
    expect(elCierreCierraElCurso(2)).toBe(false)
    expect(elCierreCierraElCurso(3)).toBe(true)
  })
})

describe('verificación del cierre (T5.2)', () => {
  const con = (id: number, valoracion: Valoracion, sesiones: number): ObjetivoEnVerificacion => ({
    asignacionId: id,
    objetivoId: id * 100,
    valoracion,
    sesiones
  })

  it('responde las cuatro preguntas consultando los datos', () => {
    const trimestre = [
      con(1, 'conseguido', 4),
      con(2, 'sin_valorar', 0),
      con(3, 'pendiente_desarrollar', 0),
      con(4, 'no_conseguido', 2),
      con(5, 'sin_valorar', 3)
    ]

    expect(verificarTrimestre(trimestre, { sesiones: 12, faltas: 2 })).toEqual({
      sinValorar: [2, 5],
      noTrabajados: [3],
      sinSesiones: [2, 3],
      incoherencias: [],
      sesiones: 12,
      faltas: 2,
      puedeCerrarse: false
    })
  })

  it('con todo valorado se puede cerrar, aunque haya avisos', () => {
    const v = verificarTrimestre([con(1, 'conseguido', 0), con(2, 'pendiente_desarrollar', 3)], { sesiones: 3, faltas: 0 })
    expect(v.puedeCerrarse).toBe(true)
    expect(v.incoherencias).toHaveLength(2)
  })

  it('avisa si lo marcó como no trabajado pero aparece en sesiones', () => {
    expect(incoherenciaDe(con(1, 'pendiente_desarrollar', 3))).toBe('no_trabajado_con_sesiones')
    expect(incoherenciaDe(con(1, 'pendiente_desarrollar', 0))).toBeNull()
  })

  it('avisa si lo valoró como trabajado pero no aparece en ninguna sesión', () => {
    expect(incoherenciaDe(con(1, 'conseguido', 0))).toBe('trabajado_sin_sesiones')
    expect(incoherenciaDe(con(1, 'no_conseguido', 0))).toBe('trabajado_sin_sesiones')
    expect(incoherenciaDe(con(1, 'conseguido', 1))).toBeNull()
  })

  it('lo que aún no está valorado no tiene incoherencias: todavía no ha dicho nada', () => {
    expect(incoherenciaDe(con(1, 'sin_valorar', 0))).toBeNull()
    expect(incoherenciaDe(con(1, 'sin_valorar', 5))).toBeNull()
  })

  it('un trimestre sin objetivos se puede cerrar y solo cuenta sesiones', () => {
    expect(verificarTrimestre([], { sesiones: 5, faltas: 1 })).toMatchObject({ puedeCerrarse: true, sesiones: 5, faltas: 1, sinValorar: [] })
  })
})

describe('trimestre siguiente (T5.3)', () => {
  it('del 1.º pasa al 2.º y del 2.º al 3.º; del 3.º, a ninguno', () => {
    expect(trimestreSiguiente(1)).toBe(2)
    expect(trimestreSiguiente(2)).toBe(3)
    expect(trimestreSiguiente(3)).toBeNull()
  })
})
