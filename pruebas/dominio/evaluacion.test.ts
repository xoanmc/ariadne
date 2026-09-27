import { describe, expect, it } from 'vitest'
import { normalizarEvaluacion, sugerenciasDeInstrumento, validarEvaluacion } from '../../src/main/dominio/evaluacion'

const HOY = '2026-09-27'
const CURSO = '2026/2027'

describe('validar la evaluación inicial', () => {
  it('con fecha y contenido basta; el instrumento es opcional', () => {
    const datos = normalizarEvaluacion({ fecha: '2026-09-18', contenido: 'Lectura silábica, lenta.' })
    expect(datos.instrumento).toBeNull()
    expect(validarEvaluacion(datos, CURSO, HOY)).toEqual([])
  })

  it('exige el contenido', () => {
    const datos = normalizarEvaluacion({ fecha: '2026-09-18', contenido: '   ' })
    expect(validarEvaluacion(datos, CURSO, HOY).map((p) => p.campo)).toEqual(['contenido'])
  })

  it('exige una fecha válida', () => {
    const datos = normalizarEvaluacion({ fecha: '2026-02-30', contenido: 'x' })
    expect(validarEvaluacion(datos, CURSO, HOY).map((p) => p.campo)).toEqual(['fecha'])
  })

  it('no admite una evaluación futura', () => {
    const datos = normalizarEvaluacion({ fecha: '2026-09-28', contenido: 'x' })
    expect(validarEvaluacion(datos, CURSO, HOY)[0].mensaje).toMatch(/posterior a hoy/)
  })

  it('tiene que ser de los años del curso', () => {
    const datos = normalizarEvaluacion({ fecha: '2025-09-18', contenido: 'x' })
    expect(validarEvaluacion(datos, CURSO, HOY)[0].mensaje).toMatch(/2026 o de 2027/)
  })

  it('conserva los saltos de línea del contenido', () => {
    const datos = normalizarEvaluacion({ fecha: '2026-09-18', contenido: '  Lectura: lenta.\nEscritura: buena.  ' })
    expect(datos.contenido).toBe('Lectura: lenta.\nEscritura: buena.')
  })
})

describe('sugerencias de instrumento', () => {
  it('ofrece los habituales aunque aún no haya usado ninguno', () => {
    expect(sugerenciasDeInstrumento([])).toEqual(['Diverlexia', 'Prolexia'])
  })

  it('añade los que ella ya ha usado, en orden alfabético', () => {
    expect(sugerenciasDeInstrumento(['WISC-V', 'Batelle'])).toEqual(['Batelle', 'Diverlexia', 'Prolexia', 'WISC-V'])
  })

  it('no repite un instrumento escrito con otras mayúsculas', () => {
    expect(sugerenciasDeInstrumento(['diverlexia', 'PROLEXIA', 'Prolexia'])).toEqual(['Diverlexia', 'Prolexia'])
  })
})
