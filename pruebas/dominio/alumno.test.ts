import { describe, expect, it } from 'vitest'
import { claveDeNombre, normalizarDatosAlumno, validarDatosAlumno } from '../../src/main/dominio/alumno'

const HOY = '2026-09-25'

describe('normalizar lo que escribe', () => {
  it('quita los espacios sobrantes', () => {
    const datos = normalizarDatosAlumno({ nombre: '  Lucía  ', apellidos: ' García   Pérez ' })
    expect(datos.nombre).toBe('Lucía')
    expect(datos.apellidos).toBe('García Pérez')
  })

  it('un campo opcional vacío queda sin dato, no como texto vacío', () => {
    const datos = normalizarDatosAlumno({ nombre: 'Lucía', apellidos: 'García', diagnosticos: '   ', notas: '' })
    expect(datos.diagnosticos).toBeNull()
    expect(datos.notas).toBeNull()
    expect(datos.fechaNacimiento).toBeNull()
  })

  it('conserva los saltos de línea de las notas, solo recorta los extremos', () => {
    const datos = normalizarDatosAlumno({ nombre: 'L', apellidos: 'G', notas: '  Primera línea\nSegunda  ' })
    expect(datos.notas).toBe('Primera línea\nSegunda')
  })

  it('ignora lo que no es texto', () => {
    const datos = normalizarDatosAlumno({ nombre: 42, apellidos: null, notas: { malo: true } })
    expect(datos.nombre).toBe('')
    expect(datos.apellidos).toBe('')
    expect(datos.notas).toBeNull()
  })
})

describe('validar el alta', () => {
  it('con nombre y apellidos basta', () => {
    const datos = normalizarDatosAlumno({ nombre: 'Lucía', apellidos: 'García' })
    expect(validarDatosAlumno(datos, HOY)).toEqual([])
  })

  it('exige nombre y apellidos, y dice cuál falta', () => {
    const problemas = validarDatosAlumno(normalizarDatosAlumno({ nombre: ' ', apellidos: '' }), HOY)
    expect(problemas.map((p) => p.campo)).toEqual(['nombre', 'apellidos'])
  })

  it('rechaza una fecha de nacimiento que no existe', () => {
    const datos = normalizarDatosAlumno({ nombre: 'Lucía', apellidos: 'García', fechaNacimiento: '2015-02-30' })
    expect(validarDatosAlumno(datos, HOY).map((p) => p.campo)).toEqual(['fechaNacimiento'])
  })

  it('rechaza una fecha de nacimiento posterior a hoy', () => {
    const datos = normalizarDatosAlumno({ nombre: 'Lucía', apellidos: 'García', fechaNacimiento: '2026-09-26' })
    expect(validarDatosAlumno(datos, HOY)[0].mensaje).toMatch(/posterior a hoy/)
  })

  it('acepta haber nacido hoy mismo', () => {
    const datos = normalizarDatosAlumno({ nombre: 'Lucía', apellidos: 'García', fechaNacimiento: HOY })
    expect(validarDatosAlumno(datos, HOY)).toEqual([])
  })
})

describe('reconocer un posible alta repetida', () => {
  it('no distingue mayúsculas, acentos ni espacios', () => {
    expect(claveDeNombre('Lucía', 'García  Pérez')).toBe(claveDeNombre('lucia', 'garcia perez'))
  })

  it('personas distintas dan claves distintas', () => {
    expect(claveDeNombre('Lucía', 'García')).not.toBe(claveDeNombre('Lucía', 'Gómez'))
  })
})
