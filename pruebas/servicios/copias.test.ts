import { chmodSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { carpetaCopias, crearCopia, listarCopias, MAXIMO_COPIAS, rotarCopias } from '../../src/main/persistencia/copias'
import type { Migracion } from '../../src/main/persistencia/migraciones'
import { NOMBRE_FICHERO, UbicacionDatos } from '../../src/main/servicios/ubicacionDatos'

const MIGRACIONES: Migracion[] = [
  { version: 1, nombre: 'alumnos', sql: 'CREATE TABLE alumno (id INTEGER PRIMARY KEY, nombre TEXT NOT NULL)' }
]

let raiz: string
let carpetaDatos: string
let ubicacion: UbicacionDatos
const abiertas: UbicacionDatos[] = []

function nueva(): UbicacionDatos {
  const creada = new UbicacionDatos(carpetaDatos, MIGRACIONES)
  abiertas.push(creada)
  return creada
}

function anotar(quien: UbicacionDatos, nombre: string): void {
  quien.conexion().prepare('INSERT INTO alumno (nombre) VALUES (?)').run(nombre)
}

function alumnos(quien: UbicacionDatos): string[] {
  return (quien.conexion().prepare('SELECT nombre FROM alumno ORDER BY id').all() as { nombre: string }[]).map(
    (a) => a.nombre
  )
}

function rutaBase(): string {
  return join(carpetaDatos, NOMBRE_FICHERO)
}

function ficherosDeCopia(): string[] {
  const carpeta = carpetaCopias(rutaBase())
  return existsSync(carpeta) ? readdirSync(carpeta).sort() : []
}

beforeEach(() => {
  raiz = mkdtempSync(join(tmpdir(), 'ariadne-copias-'))
  carpetaDatos = join(raiz, 'datos-usuario')
  mkdirSync(carpetaDatos, { recursive: true })
  ubicacion = nueva()
  ubicacion.iniciar()
})

afterEach(() => {
  abiertas.splice(0).forEach((u) => u.cerrar())
  rmSync(raiz, { recursive: true, force: true })
})

describe('copia automática al arrancar', () => {
  it('el primer arranque no copia una base recién creada y vacía', () => {
    expect(ficherosDeCopia()).toEqual([])
  })

  it('cada arranque posterior deja una copia junto a los datos', () => {
    anotar(ubicacion, 'Ana')
    ubicacion.cerrar()

    const segunda = nueva()
    expect(segunda.iniciar().tipo).toBe('lista')
    expect(ficherosDeCopia()).toHaveLength(1)
  })

  it('la copia contiene lo registrado hasta ese momento', () => {
    anotar(ubicacion, 'Ana')
    const copia = crearCopia(ubicacion.conexion(), rutaBase())
    anotar(ubicacion, 'Luis')

    const restaurada = nueva()
    restaurada.abrir(copia.ruta)
    expect(alumnos(restaurada)).toEqual(['Ana'])
  })

  it('un fallo al copiar no impide abrir la aplicación', () => {
    anotar(ubicacion, 'Ana')
    ubicacion.cerrar()
    // Una carpeta de copias sin permiso de escritura imita un USB protegido o un disco lleno
    mkdirSync(carpetaCopias(rutaBase()), { recursive: true })
    chmodSync(carpetaCopias(rutaBase()), 0o500)

    const segunda = nueva()
    const estado = segunda.iniciar()

    chmodSync(carpetaCopias(rutaBase()), 0o700)
    expect(estado.tipo).toBe('lista')
    expect(estado.tipo === 'lista' && estado.avisoCopia).toMatch(/No se pudo guardar la copia/)
    expect(alumnos(segunda)).toEqual(['Ana'])
  })
})

describe('rotación', () => {
  it('conserva las diez últimas y la undécima elimina la más antigua', () => {
    anotar(ubicacion, 'Ana')
    const creadas: string[] = []
    for (let i = 0; i < MAXIMO_COPIAS + 1; i++) {
      const fecha = new Date(2026, 0, 1, 9, 0, i)
      creadas.push(crearCopia(ubicacion.conexion(), rutaBase(), fecha).nombre)
      rotarCopias(rutaBase())
    }

    const quedan = ficherosDeCopia()
    expect(quedan).toHaveLength(MAXIMO_COPIAS)
    expect(quedan).not.toContain(creadas[0])
    expect(quedan).toContain(creadas.at(-1))
  })

  it('lista las copias de la más reciente a la más antigua', () => {
    anotar(ubicacion, 'Ana')
    crearCopia(ubicacion.conexion(), rutaBase(), new Date(2026, 0, 1, 9, 0, 0))
    crearCopia(ubicacion.conexion(), rutaBase(), new Date(2026, 0, 2, 9, 0, 0))

    expect(listarCopias(rutaBase()).map((c) => c.nombre)).toEqual([
      'ariadne-2026-01-02_09-00-00.sqlite',
      'ariadne-2026-01-01_09-00-00.sqlite'
    ])
  })

  it('dos copias en el mismo segundo no se pisan', () => {
    anotar(ubicacion, 'Ana')
    const fecha = new Date(2026, 0, 1, 9, 0, 0)
    const primera = crearCopia(ubicacion.conexion(), rutaBase(), fecha)
    const segunda = crearCopia(ubicacion.conexion(), rutaBase(), fecha)

    expect(segunda.ruta).not.toBe(primera.ruta)
    expect(ficherosDeCopia()).toHaveLength(2)
  })
})

describe('restaurar', () => {
  it('una copia restaurada devuelve el estado exacto', () => {
    anotar(ubicacion, 'Ana')
    const copia = crearCopia(ubicacion.conexion(), rutaBase())
    anotar(ubicacion, 'Luis')
    expect(alumnos(ubicacion)).toEqual(['Ana', 'Luis'])

    const resultado = ubicacion.restaurarDesde(copia.ruta)

    expect(resultado.tipo).toBe('restaurada')
    expect(alumnos(ubicacion)).toEqual(['Ana'])
  })

  it('guarda el estado actual como copia antes de sustituirlo', () => {
    anotar(ubicacion, 'Ana')
    const copia = crearCopia(ubicacion.conexion(), rutaBase())
    anotar(ubicacion, 'Luis')

    const resultado = ubicacion.restaurarDesde(copia.ruta)

    expect(resultado.tipo === 'restaurada' && existsSync(resultado.copiaPrevia)).toBe(true)
    if (resultado.tipo !== 'restaurada') throw new Error('no restaurada')

    const arrepentida = nueva()
    arrepentida.abrir(resultado.copiaPrevia)
    expect(alumnos(arrepentida)).toEqual(['Ana', 'Luis'])
  })

  it('lo restaurado persiste tras cerrar y volver a abrir', () => {
    anotar(ubicacion, 'Ana')
    const copia = crearCopia(ubicacion.conexion(), rutaBase())
    anotar(ubicacion, 'Luis')
    ubicacion.restaurarDesde(copia.ruta)
    ubicacion.cerrar()

    const siguiente = nueva()
    siguiente.iniciar()
    expect(alumnos(siguiente)).toEqual(['Ana'])
  })

  it('un fichero que no es una copia de Ariadne se rechaza y los datos siguen intactos', () => {
    anotar(ubicacion, 'Ana')
    const falso = join(raiz, 'cualquier-cosa.sqlite')
    writeFileSync(falso, 'esto no es una base de datos')

    const resultado = ubicacion.restaurarDesde(falso)

    expect(resultado.tipo).toBe('error')
    expect(alumnos(ubicacion)).toEqual(['Ana'])
    expect(ubicacion.estado.tipo).toBe('lista')
  })

  it('restaurar la base que está en uso no tiene sentido y se rechaza', () => {
    expect(ubicacion.restaurarDesde(rutaBase()).tipo).toBe('error')
    expect(ubicacion.estado.tipo).toBe('lista')
  })
})

describe('copia manual', () => {
  it('guarda una copia donde ella elija', () => {
    anotar(ubicacion, 'Ana')
    const destino = join(raiz, 'copia-para-el-usb.sqlite')

    expect(ubicacion.guardarCopiaEn(destino)).toEqual({ tipo: 'guardada', ruta: destino })

    const llevada = nueva()
    llevada.abrir(destino)
    expect(alumnos(llevada)).toEqual(['Ana'])
  })

  it('sustituye un fichero anterior sin dejarlo a medias', () => {
    anotar(ubicacion, 'Ana')
    const destino = join(raiz, 'copia-para-el-usb.sqlite')
    ubicacion.guardarCopiaEn(destino)
    anotar(ubicacion, 'Luis')

    expect(ubicacion.guardarCopiaEn(destino).tipo).toBe('guardada')
    expect(existsSync(`${destino}.parcial`)).toBe(false)

    const llevada = nueva()
    llevada.abrir(destino)
    expect(alumnos(llevada)).toEqual(['Ana', 'Luis'])
  })

  it('no deja restos si la copia manual falla', () => {
    anotar(ubicacion, 'Ana')
    const destino = join(raiz, 'sin-permiso', 'copia.sqlite')

    expect(ubicacion.guardarCopiaEn(destino).tipo).toBe('error')
    expect(existsSync(`${destino}.parcial`)).toBe(false)
  })

  it('la copia manual no cuenta para la rotación de las automáticas', () => {
    anotar(ubicacion, 'Ana')
    const destino = join(carpetaDatos, 'copia-suelta.sqlite')
    ubicacion.guardarCopiaEn(destino)
    for (let i = 0; i < MAXIMO_COPIAS + 3; i++) {
      crearCopia(ubicacion.conexion(), rutaBase(), new Date(2026, 0, 1, 9, 0, i))
      rotarCopias(rutaBase())
    }

    expect(existsSync(destino)).toBe(true)
    expect(readFileSync(destino).length).toBeGreaterThan(0)
  })
})
