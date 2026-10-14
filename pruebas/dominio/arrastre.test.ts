import { describe, expect, it } from 'vitest'
import {
  ErrorCadena,
  estaCompleta,
  estaEstancado,
  finalesDeCadena,
  pendientesAlAcabarCurso,
  rachaPendienteDesarrollar,
  trimestresEstancado,
  recorrerCadena,
  type Eslabon
} from '../../src/main/dominio/arrastre'
import type { Valoracion } from '../../src/main/dominio/vocabulario'

function eslabon(id: number, valoracion: Valoracion, anterior: number | null = null): Eslabon {
  return { id, trimestreId: id * 10, valoracion, asignacionAnteriorId: anterior }
}

describe('recorrerCadena', () => {
  it('devuelve el recorrido completo, del origen al trimestre actual', () => {
    const asignaciones = [
      eslabon(1, 'no_conseguido'),
      eslabon(2, 'pendiente_desarrollar', 1),
      eslabon(3, 'conseguido', 2)
    ]

    expect(recorrerCadena(asignaciones, 3).map((e) => e.id)).toEqual([1, 2, 3])
  })

  it('cruza de curso sin romperse', () => {
    // El objetivo del curso nuevo es otro objetivo, pero su primera asignación enlaza con la última del anterior
    const cursoAnterior = [eslabon(1, 'no_conseguido'), eslabon(2, 'pendiente_desarrollar', 1)]
    const cursoNuevo = [eslabon(3, 'pendiente_desarrollar', 2)]

    const cadena = recorrerCadena([...cursoAnterior, ...cursoNuevo], 3)

    expect(cadena.map((e) => e.id)).toEqual([1, 2, 3])
    expect(estaCompleta(cadena)).toBe(true)
  })

  it('el recorrido de una asignación sin historia es ella sola', () => {
    expect(recorrerCadena([eslabon(1, 'sin_valorar')], 1).map((e) => e.id)).toEqual([1])
  })

  it('avisa si el historial cargado no llega hasta el origen', () => {
    const cadena = recorrerCadena([eslabon(2, 'no_conseguido', 1)], 2)
    expect(cadena.map((e) => e.id)).toEqual([2])
    expect(estaCompleta(cadena)).toBe(false)
  })

  it('no se cuelga si la cadena se muerde la cola', () => {
    const asignaciones = [eslabon(1, 'no_conseguido', 2), eslabon(2, 'no_conseguido', 1)]
    expect(() => recorrerCadena(asignaciones, 2)).toThrow(ErrorCadena)
  })

  it('protesta si la asignación no está', () => {
    expect(() => recorrerCadena([eslabon(1, 'conseguido')], 99)).toThrow(ErrorCadena)
  })
})

describe('objetivos estancados', () => {
  it('cuenta los trimestres consecutivos sin abordar, contando desde el último', () => {
    const cadena = [
      eslabon(1, 'pendiente_desarrollar'),
      eslabon(2, 'no_conseguido', 1),
      eslabon(3, 'pendiente_desarrollar', 2),
      eslabon(4, 'pendiente_desarrollar', 3)
    ]
    expect(rachaPendienteDesarrollar(cadena)).toBe(2)
  })

  it('el aviso salta al segundo trimestre consecutivo, no al primero', () => {
    const primero = [eslabon(1, 'pendiente_desarrollar')]
    const segundo = [...primero, eslabon(2, 'pendiente_desarrollar', 1)]

    expect(estaEstancado(primero)).toBe(false)
    expect(estaEstancado(segundo)).toBe(true)
  })

  it('sigue avisando mientras la racha continúa', () => {
    const cadena = [
      eslabon(1, 'pendiente_desarrollar'),
      eslabon(2, 'pendiente_desarrollar', 1),
      eslabon(3, 'pendiente_desarrollar', 2)
    ]
    expect(estaEstancado(cadena)).toBe(true)
  })

  it('haberlo trabajado en el último trimestre rompe la racha', () => {
    const cadena = [
      eslabon(1, 'pendiente_desarrollar'),
      eslabon(2, 'pendiente_desarrollar', 1),
      eslabon(3, 'no_conseguido', 2)
    ]
    expect(rachaPendienteDesarrollar(cadena)).toBe(0)
    expect(estaEstancado(cadena)).toBe(false)
  })
})

describe('aviso de estancados (T5.5)', () => {
  it('con la valoración de este trimestre ya puesta, cuenta la racha completa', () => {
    const cadena = [eslabon(1, 'pendiente_desarrollar'), eslabon(2, 'pendiente_desarrollar', 1), eslabon(3, 'pendiente_desarrollar', 2)]
    expect(trimestresEstancado(cadena)).toBe(3)
  })

  it('aún sin valorar en este trimestre, avisa con la racha con la que llega', () => {
    const cadena = [eslabon(1, 'pendiente_desarrollar'), eslabon(2, 'pendiente_desarrollar', 1), eslabon(3, 'sin_valorar', 2)]
    expect(trimestresEstancado(cadena)).toBe(2)
  })

  it('no avisa al primer trimestre pendiente ni cuando se rompe la racha', () => {
    expect(trimestresEstancado([eslabon(1, 'pendiente_desarrollar'), eslabon(2, 'sin_valorar', 1)])).toBeNull()
    expect(trimestresEstancado([eslabon(1, 'pendiente_desarrollar'), eslabon(2, 'pendiente_desarrollar', 1), eslabon(3, 'conseguido', 2)])).toBeNull()
    expect(trimestresEstancado([eslabon(1, 'sin_valorar')])).toBeNull()
  })
})

describe('pendientes al acabar el curso', () => {
  const en = (id: number, numeroTrimestre: number, valoracion: Valoracion, anterior: number | null = null) => ({
    ...eslabon(id, valoracion, anterior),
    numeroTrimestre
  })

  it('el final de cada cadena es la asignación que nadie continúa', () => {
    const asignaciones = [eslabon(1, 'no_conseguido'), eslabon(2, 'conseguido', 1), eslabon(3, 'pendiente_desarrollar')]
    expect(finalesDeCadena(asignaciones).map((a) => a.id)).toEqual([2, 3])
  })

  it('solo cuenta lo que llegó al tercer trimestre sin conseguirse o sin abordarse', () => {
    const asignaciones = [
      en(1, 1, 'no_conseguido'),
      en(2, 2, 'no_conseguido', 1),
      en(3, 3, 'no_conseguido', 2), // arrastrado hasta el final: pendiente
      en(4, 3, 'pendiente_desarrollar'), // sin abordar en el tercero: pendiente
      en(5, 3, 'conseguido'), // conseguido: no
      en(6, 2, 'no_conseguido') // se dejó caer en el segundo trimestre: decisión suya, no
    ]
    expect(pendientesAlAcabarCurso(asignaciones).map((a) => a.id)).toEqual([3, 4])
  })
})
