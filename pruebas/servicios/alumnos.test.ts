import type Database from 'better-sqlite3'
import { beforeEach, describe, expect, it } from 'vitest'
import type { DatosAlumno } from '../../src/compartido/ipc'
import { darDeAlta, editarAlumno, listarAlumnos, obtenerAlumno } from '../../src/main/servicios/alumnos'
import { crearBaseDePrueba, MIGRACIONES_REALES } from '../ayudas/baseDePrueba'
import { aplicarMigraciones } from '../../src/main/persistencia/migraciones'
import BetterSqlite from 'better-sqlite3'

const HOY = '2026-09-25'

let db: Database.Database

function datos(nombre: string, apellidos: string, extra: Partial<DatosAlumno> = {}): DatosAlumno {
  return { nombre, apellidos, fechaNacimiento: null, diagnosticos: null, notas: null, ...extra }
}

function alta(nombre: string, apellidos: string, extra: Partial<DatosAlumno> = {}) {
  const resultado = darDeAlta(db, datos(nombre, apellidos, extra), false, HOY)
  if (resultado.tipo !== 'creado') throw new Error(`alta fallida: ${resultado.tipo}`)
  return resultado.alumno
}

beforeEach(() => {
  db = crearBaseDePrueba()
})

describe('alta de alumno', () => {
  it('da de alta un alumno y le asigna el primer código', () => {
    const alumno = alta('Lucía', 'García Pérez', { fechaNacimiento: '2015-03-02', diagnosticos: 'TEA' })

    expect(alumno).toMatchObject({
      codigoInterno: 'A-01',
      nombre: 'Lucía',
      apellidos: 'García Pérez',
      fechaNacimiento: '2015-03-02',
      diagnosticos: 'TEA',
      notas: null
    })
  })

  it('los códigos son correlativos por orden de alta', () => {
    expect([alta('Lucía', 'García'), alta('Mario', 'Ruiz'), alta('Ana', 'López')].map((a) => a.codigoInterno)).toEqual([
      'A-01',
      'A-02',
      'A-03'
    ])
  })

  it('pasa de A-99 a A-100 sin tropezar', () => {
    db.prepare('UPDATE secuencia_codigo SET ultimo = 98').run()
    expect(alta('Lucía', 'García').codigoInterno).toBe('A-99')
    expect(alta('Mario', 'Ruiz').codigoInterno).toBe('A-100')
  })

  it('con datos incompletos no da de alta ni gasta un código', () => {
    const resultado = darDeAlta(db, datos('Lucía', ''), false, HOY)

    expect(resultado).toEqual({ tipo: 'invalido', problemas: [{ campo: 'apellidos', mensaje: 'Escribe los apellidos.' }] })
    expect(listarAlumnos(db)).toEqual([])
    expect(alta('Lucía', 'García').codigoInterno).toBe('A-01')
  })

  it('la interfaz no puede elegir el código aunque lo intente', () => {
    const conCodigo = { ...datos('Lucía', 'García'), codigoInterno: 'A-50' } as DatosAlumno
    const resultado = darDeAlta(db, conCodigo, false, HOY)
    expect(resultado.tipo === 'creado' && resultado.alumno.codigoInterno).toBe('A-01')
  })
})

describe('el código nunca cambia', () => {
  it('editar la ficha no toca el código', () => {
    const alumno = alta('Lucía', 'García')
    const resultado = editarAlumno(db, alumno.id, datos('Lucía María', 'García Pérez', { notas: 'Le cuesta el ruido' }), HOY)

    expect(resultado).toEqual({
      tipo: 'guardado',
      alumno: expect.objectContaining({ codigoInterno: 'A-01', nombre: 'Lucía María', notas: 'Le cuesta el ruido' })
    })
  })

  it('la propia base de datos rechaza cambiarlo, aunque alguien lo intente por fuera de la aplicación', () => {
    const alumno = alta('Lucía', 'García')
    expect(() => db.prepare("UPDATE alumno SET codigo_interno = 'A-50' WHERE id = ?").run(alumno.id)).toThrow(
      /no cambia nunca/
    )
    expect(obtenerAlumno(db, alumno.id)?.codigoInterno).toBe('A-01')
  })

  it('un código no se reutiliza aunque se borre al último alumno', () => {
    alta('Lucía', 'García')
    const segundo = alta('Mario', 'Ruiz')
    db.prepare('DELETE FROM alumno WHERE id = ?').run(segundo.id)

    expect(alta('Ana', 'López').codigoInterno).toBe('A-03')
  })

  it('la secuencia no puede retroceder', () => {
    alta('Lucía', 'García')
    expect(() => db.prepare('UPDATE secuencia_codigo SET ultimo = 0').run()).toThrow(/no puede retroceder/)
  })
})

describe('posible alta repetida', () => {
  it('avisa si ya hay alguien con el mismo nombre, y no da de alta todavía', () => {
    const lucia = alta('Lucía', 'García')
    const resultado = darDeAlta(db, datos('lucia', 'garcía'), false, HOY)

    expect(resultado).toEqual({ tipo: 'posible_duplicado', coincidencias: [lucia] })
    expect(listarAlumnos(db)).toHaveLength(1)
  })

  it('si ella confirma que es otra persona, se da de alta con su propio código', () => {
    alta('Lucía', 'García')
    const resultado = darDeAlta(db, datos('Lucía', 'García'), true, HOY)

    expect(resultado.tipo === 'creado' && resultado.alumno.codigoInterno).toBe('A-02')
  })
})

describe('editar la ficha', () => {
  it('rechaza dejar la ficha sin nombre', () => {
    const alumno = alta('Lucía', 'García')
    const resultado = editarAlumno(db, alumno.id, datos('', 'García'), HOY)

    expect(resultado.tipo).toBe('invalido')
    expect(obtenerAlumno(db, alumno.id)?.nombre).toBe('Lucía')
  })

  it('permite borrar un dato opcional', () => {
    const alumno = alta('Lucía', 'García', { diagnosticos: 'TEA' })
    editarAlumno(db, alumno.id, datos('Lucía', 'García', { diagnosticos: '' }), HOY)

    expect(obtenerAlumno(db, alumno.id)?.diagnosticos).toBeNull()
  })

  it('un alumno que no existe se dice claramente', () => {
    expect(editarAlumno(db, 999, datos('Lucía', 'García'), HOY)).toEqual({ tipo: 'no_existe' })
    expect(editarAlumno(db, 'uno', datos('Lucía', 'García'), HOY)).toEqual({ tipo: 'no_existe' })
  })
})

describe('listado', () => {
  it('ordena por nombre como en un diccionario español', () => {
    alta('Óscar', 'Martín')
    alta('Lucía', 'García')
    alta('Álvaro', 'Ruiz')
    alta('Lucía', 'Álvarez')

    expect(listarAlumnos(db).map((a) => `${a.nombre} ${a.apellidos}`)).toEqual([
      'Álvaro Ruiz',
      'Lucía Álvarez',
      'Lucía García',
      'Óscar Martín'
    ])
  })

  it('obtener con un identificador raro no revienta', () => {
    expect(obtenerAlumno(db, 999)).toBeNull()
    expect(obtenerAlumno(db, -1)).toBeNull()
    expect(obtenerAlumno(db, '1')).toBeNull()
  })
})

describe('migración en una base que ya tenía alumnos', () => {
  it('la secuencia arranca después del código más alto ya entregado', () => {
    const vieja = new BetterSqlite(':memory:')
    aplicarMigraciones(vieja, MIGRACIONES_REALES.filter((m) => m.version === 1))
    vieja.prepare("INSERT INTO alumno (codigo_interno, nombre, apellidos) VALUES ('A-04', 'Lucía', 'García')").run()

    aplicarMigraciones(vieja, MIGRACIONES_REALES)
    const resultado = darDeAlta(vieja, datos('Mario', 'Ruiz'), false, HOY)

    expect(resultado.tipo === 'creado' && resultado.alumno.codigoInterno).toBe('A-05')
  })
})
