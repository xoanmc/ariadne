import { describe, expect, it } from 'vitest'
import { coincideBusqueda, normalizarBusqueda } from '../../src/compartido/busqueda'

const LUCIA = { nombre: 'Lucía', apellidos: 'García Pérez', codigoInterno: 'A-07' }

describe('normalizar', () => {
  it('quita acentos, mayúsculas y espacios sobrantes', () => {
    expect(normalizarBusqueda('  LUCÍA   García ')).toBe('lucia garcia')
  })
})

describe('buscar un alumno', () => {
  it('encuentra por el principio del nombre', () => {
    expect(coincideBusqueda(LUCIA, 'luc')).toBe(true)
  })

  it('no distingue acentos ni mayúsculas, en ninguno de los dos sentidos', () => {
    expect(coincideBusqueda(LUCIA, 'LUCIA')).toBe(true)
    expect(coincideBusqueda({ ...LUCIA, nombre: 'Lucia' }, 'Lucía')).toBe(true)
  })

  it('encuentra por apellidos', () => {
    expect(coincideBusqueda(LUCIA, 'perez')).toBe(true)
  })

  it('varias palabras, en cualquier orden', () => {
    expect(coincideBusqueda(LUCIA, 'garcia luc')).toBe(true)
  })

  it('todas las palabras tienen que estar', () => {
    expect(coincideBusqueda(LUCIA, 'lucia ruiz')).toBe(false)
  })

  it('encuentra por código, con o sin guion', () => {
    expect(coincideBusqueda(LUCIA, 'A-07')).toBe(true)
    expect(coincideBusqueda(LUCIA, 'a07')).toBe(true)
    expect(coincideBusqueda(LUCIA, 'a-08')).toBe(false)
  })

  it('una búsqueda vacía no filtra nada', () => {
    expect(coincideBusqueda(LUCIA, '')).toBe(true)
    expect(coincideBusqueda(LUCIA, '   ')).toBe(true)
  })

  it('la eñe se encuentra escrita con o sin tilde', () => {
    const nunez = { nombre: 'Íñigo', apellidos: 'Núñez', codigoInterno: 'A-02' }
    expect(coincideBusqueda(nunez, 'iñigo')).toBe(true)
    expect(coincideBusqueda(nunez, 'nunez')).toBe(true)
  })
})
