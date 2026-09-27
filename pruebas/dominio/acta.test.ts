import { describe, expect, it } from 'vitest'
import { normalizarActa, validarActa } from '../../src/main/dominio/acta'

const HOY = '2026-09-27'
const CURSO = '2026/2027'

describe('validar un acta', () => {
  it('con fecha y contenido basta', () => {
    const datos = normalizarActa({ fecha: '2026-09-25', contenido: 'Se revisa la adaptación al curso.' })
    expect(validarActa(datos, CURSO, HOY)).toEqual([])
  })

  it('también basta con los acuerdos, sin contenido', () => {
    const datos = normalizarActa({ fecha: '2026-09-25', acuerdos: 'Revisar en diciembre.' })
    expect(validarActa(datos, CURSO, HOY)).toEqual([])
  })

  it('sin contenido ni acuerdos no hay acta', () => {
    const datos = normalizarActa({ fecha: '2026-09-25', asistentes: 'Madre y tutora', contenido: '  ', acuerdos: '' })
    expect(validarActa(datos, CURSO, HOY)).toEqual([
      { campo: 'contenido', mensaje: 'Escribe el contenido de la reunión, los acuerdos, o ambos.' }
    ])
  })

  it('recoge una reunión que ya ha pasado: no puede ser futura', () => {
    const datos = normalizarActa({ fecha: '2026-10-01', contenido: 'x' })
    expect(validarActa(datos, CURSO, HOY)[0]).toEqual({ campo: 'fecha', mensaje: 'La fecha no puede ser posterior a hoy.' })
  })

  it('tiene que ser de los años del curso', () => {
    const datos = normalizarActa({ fecha: '2025-06-10', contenido: 'x' })
    expect(validarActa(datos, CURSO, HOY)[0].mensaje).toMatch(/2026 o de 2027/)
  })

  it('pide la fecha si falta', () => {
    const datos = normalizarActa({ contenido: 'x' })
    expect(validarActa(datos, CURSO, HOY)[0]).toEqual({ campo: 'fecha', mensaje: 'Indica la fecha de la reunión.' })
  })

  it('los campos vacíos quedan sin dato y se conservan los saltos de línea', () => {
    const datos = normalizarActa({ fecha: '2026-09-25', asistentes: '  ', contenido: ' Uno.\nDos. ', acuerdos: '' })
    expect(datos).toEqual({ fecha: '2026-09-25', asistentes: null, contenido: 'Uno.\nDos.', acuerdos: null })
  })
})
