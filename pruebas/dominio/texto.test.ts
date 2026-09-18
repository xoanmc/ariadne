import { describe, expect, it } from 'vitest'
import { normalizarEspacios } from '../../src/main/dominio/texto'

describe('normalizarEspacios', () => {
  it('recorta los extremos y colapsa los espacios internos', () => {
    expect(normalizarEspacios('  Hola   desde\tla  interfaz \n')).toBe('Hola desde la interfaz')
  })
})
