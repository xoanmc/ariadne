import { describe, expect, it } from 'vitest'
import type { PeriodoTrimestre } from '../../src/main/dominio/calendario'
import {
  cursoDeFecha,
  esPosteriorATodos,
  extremosDeCurso,
  fechasPropuestas,
  validarCurso
} from '../../src/main/dominio/curso'

describe('formato del curso', () => {
  it('reconoce un curso con dos años seguidos', () => {
    expect(extremosDeCurso('2026/2027')).toEqual([2026, 2027])
  })

  it('rechaza otros formatos y años que no son seguidos', () => {
    expect(extremosDeCurso('2026-2027')).toBeNull()
    expect(extremosDeCurso('26/27')).toBeNull()
    expect(extremosDeCurso('2026/2028')).toBeNull()
    expect(extremosDeCurso('2027/2026')).toBeNull()
  })
})

describe('qué curso toca', () => {
  it('desde agosto se propone el curso que empieza ese año', () => {
    expect(cursoDeFecha('2026-08-01')).toBe('2026/2027')
    expect(cursoDeFecha('2026-09-27')).toBe('2026/2027')
    expect(cursoDeFecha('2026-12-31')).toBe('2026/2027')
  })

  it('hasta julio sigue siendo el curso que empezó el año anterior', () => {
    expect(cursoDeFecha('2027-01-10')).toBe('2026/2027')
    expect(cursoDeFecha('2027-07-31')).toBe('2026/2027')
  })
})

describe('fechas propuestas', () => {
  it('son los meses completos de cada trimestre', () => {
    expect(fechasPropuestas('2026/2027')).toEqual([
      { numero: 1, fechaInicio: '2026-09-01', fechaFin: '2026-12-31' },
      { numero: 2, fechaInicio: '2027-01-01', fechaFin: '2027-03-31' },
      { numero: 3, fechaInicio: '2027-04-01', fechaFin: '2027-06-30' }
    ])
  })

  it('son válidas tal cual, sin tocarlas', () => {
    expect(validarCurso('2026/2027', fechasPropuestas('2026/2027'))).toEqual([])
  })
})

describe('validar un curso', () => {
  const REAL: PeriodoTrimestre[] = [
    { numero: 1, fechaInicio: '2026-09-10', fechaFin: '2026-12-22' },
    { numero: 2, fechaInicio: '2027-01-08', fechaFin: '2027-03-26' },
    { numero: 3, fechaInicio: '2027-04-06', fechaFin: '2027-06-23' }
  ]

  it('admite el calendario real de un centro, con sus vacaciones entre trimestres', () => {
    expect(validarCurso('2026/2027', REAL)).toEqual([])
  })

  it('exige un curso bien escrito', () => {
    expect(validarCurso('26-27', REAL).map((p) => p.campo)).toEqual(['curso'])
  })

  it('señala el trimestre que se solapa con el anterior', () => {
    const solapado = [REAL[0], { ...REAL[1], fechaInicio: '2026-12-15' }, REAL[2]]
    const problemas = validarCurso('2026/2027', solapado)
    expect(problemas).toHaveLength(1)
    expect(problemas[0]).toMatchObject({ campo: 'trimestre2' })
    expect(problemas[0].mensaje).toMatch(/antes de que acabe el trimestre 1/)
  })

  it('caza una errata en el año', () => {
    const errata = [REAL[0], REAL[1], { ...REAL[2], fechaFin: '2072-06-23' }]
    const problemas = validarCurso('2026/2027', errata)
    expect(problemas).toEqual([
      { campo: 'trimestre3', mensaje: 'Las fechas tienen que ser de 2026 o de 2027, los años del curso.' }
    ])
  })

  it('rechaza un trimestre que acaba antes de empezar', () => {
    const invertido = [{ ...REAL[0], fechaInicio: '2026-12-22', fechaFin: '2026-09-10' }, REAL[1], REAL[2]]
    expect(validarCurso('2026/2027', invertido)).toContainEqual({
      campo: 'trimestre1',
      mensaje: 'La fecha de fin es anterior a la de inicio.'
    })
  })

  it('exige los tres trimestres con fechas válidas', () => {
    const problemas = validarCurso('2026/2027', [REAL[0], { ...REAL[1], fechaFin: '' }])
    expect(problemas.map((p) => p.campo).sort()).toEqual(['trimestre2', 'trimestre3'])
  })
})

describe('orden de los cursos', () => {
  it('solo se abre un curso posterior a los que ya tiene', () => {
    expect(esPosteriorATodos('2026/2027', ['2024/2025', '2025/2026'])).toBe(true)
    expect(esPosteriorATodos('2024/2025', ['2025/2026'])).toBe(false)
    expect(esPosteriorATodos('2025/2026', ['2025/2026'])).toBe(false)
    expect(esPosteriorATodos('2026/2027', [])).toBe(true)
  })
})
