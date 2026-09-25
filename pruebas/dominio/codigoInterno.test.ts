import { describe, expect, it } from 'vitest'
import { formatearCodigo, siguienteCodigo } from '../../src/main/dominio/codigoInterno'

describe('formato del código interno', () => {
  it('usa A- y al menos dos cifras', () => {
    expect(formatearCodigo(1)).toBe('A-01')
    expect(formatearCodigo(7)).toBe('A-07')
    expect(formatearCodigo(99)).toBe('A-99')
  })

  it('a partir del cien crece sin más', () => {
    expect(formatearCodigo(100)).toBe('A-100')
    expect(formatearCodigo(1234)).toBe('A-1234')
  })

  it('no existe el código cero ni los negativos', () => {
    expect(() => formatearCodigo(0)).toThrow(RangeError)
    expect(() => formatearCodigo(-3)).toThrow(RangeError)
    expect(() => formatearCodigo(2.5)).toThrow(RangeError)
  })
})

describe('siguiente código', () => {
  it('parte del último número entregado', () => {
    expect(siguienteCodigo(0)).toBe('A-01')
    expect(siguienteCodigo(6)).toBe('A-07')
    expect(siguienteCodigo(99)).toBe('A-100')
  })
})
