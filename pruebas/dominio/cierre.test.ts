import { describe, expect, it } from 'vitest'
import {
  arrastrables,
  elCierreCierraElCurso,
  puedeCerrarseTrimestre,
  sinValorar,
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
