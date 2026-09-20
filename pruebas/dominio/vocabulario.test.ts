import { describe, expect, it } from 'vitest'
import {
  esArrastrable,
  esValoracion,
  estaValorado,
  ETIQUETAS_VALORACION,
  seTrabajo,
  VALORACIONES
} from '../../src/main/dominio/vocabulario'

describe('rúbrica', () => {
  it('tiene exactamente los cuatro estados que ella usa', () => {
    expect(VALORACIONES).toEqual(['sin_valorar', 'conseguido', 'no_conseguido', 'pendiente_desarrollar'])
  })

  it('reconoce lo que es una valoración y lo que no', () => {
    expect(esValoracion('conseguido')).toBe(true)
    expect(esValoracion('casi_conseguido')).toBe(false)
  })

  it('se lee con las palabras de ella', () => {
    expect(ETIQUETAS_VALORACION.pendiente_desarrollar).toBe('pendiente de desarrollar')
  })

  it('distingue si el objetivo llegó a trabajarse del resultado que tuvo', () => {
    expect(seTrabajo('conseguido')).toBe(true)
    expect(seTrabajo('no_conseguido')).toBe(true)
    expect(seTrabajo('pendiente_desarrollar')).toBe(false)
    expect(seTrabajo('sin_valorar')).toBe(false)
  })

  it('solo lo no conseguido y lo no abordado se arrastran', () => {
    expect(VALORACIONES.filter(esArrastrable)).toEqual(['no_conseguido', 'pendiente_desarrollar'])
  })

  it('sin valorar es lo único que cuenta como no valorado', () => {
    expect(VALORACIONES.filter((v) => !estaValorado(v))).toEqual(['sin_valorar'])
  })
})
