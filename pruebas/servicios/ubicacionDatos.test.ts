import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, unlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { Migracion } from '../../src/main/persistencia/migraciones'
import { NOMBRE_FICHERO, UbicacionDatos } from '../../src/main/servicios/ubicacionDatos'

const MIGRACIONES: Migracion[] = [
  { version: 1, nombre: 'alumnos', sql: 'CREATE TABLE alumno (id INTEGER PRIMARY KEY, nombre TEXT NOT NULL)' }
]

let raiz: string
let carpetaDatos: string
const abiertas: UbicacionDatos[] = []

function nuevaUbicacion(migraciones = MIGRACIONES): UbicacionDatos {
  const ubicacion = new UbicacionDatos(carpetaDatos, migraciones)
  abiertas.push(ubicacion)
  return ubicacion
}

function carpeta(nombre: string): string {
  const ruta = join(raiz, nombre)
  mkdirSync(ruta, { recursive: true })
  return ruta
}

function nombresAlumnos(ubicacion: UbicacionDatos): string[] {
  return (ubicacion.conexion().prepare('SELECT nombre FROM alumno ORDER BY id').all() as { nombre: string }[]).map(
    (a) => a.nombre
  )
}

function rutaConfigurada(): string {
  return JSON.parse(readFileSync(join(carpetaDatos, 'configuracion.json'), 'utf8')).rutaBaseDatos
}

beforeEach(() => {
  raiz = mkdtempSync(join(tmpdir(), 'ariadne-'))
  carpetaDatos = carpeta('datos-usuario')
})

afterEach(() => {
  abiertas.splice(0).forEach((u) => u.cerrar())
  rmSync(raiz, { recursive: true, force: true })
})

describe('arranque', () => {
  it('el primer arranque crea la base en la carpeta por defecto, aplica migraciones y guarda la ruta', () => {
    const ubicacion = nuevaUbicacion()
    const estado = ubicacion.iniciar()

    const rutaEsperada = join(carpetaDatos, NOMBRE_FICHERO)
    expect(estado).toEqual({ tipo: 'lista', ruta: rutaEsperada })
    expect(existsSync(rutaEsperada)).toBe(true)
    expect(rutaConfigurada()).toBe(rutaEsperada)
    ubicacion.conexion().prepare('INSERT INTO alumno (nombre) VALUES (?)').run('Ana')
  })

  it('los arranques siguientes abren la misma base con sus datos', () => {
    const primera = nuevaUbicacion()
    primera.iniciar()
    primera.conexion().prepare('INSERT INTO alumno (nombre) VALUES (?)').run('Ana')
    primera.cerrar()

    const segunda = nuevaUbicacion()
    expect(segunda.iniciar().tipo).toBe('lista')
    expect(nombresAlumnos(segunda)).toEqual(['Ana'])
  })

  it('aplica al arrancar las migraciones que falten', () => {
    nuevaUbicacion().iniciar()
    abiertas.splice(0).forEach((u) => u.cerrar())

    const conNueva = nuevaUbicacion([
      ...MIGRACIONES,
      { version: 2, nombre: 'notas', sql: 'ALTER TABLE alumno ADD COLUMN notas TEXT' }
    ])
    expect(conNueva.iniciar().tipo).toBe('lista')
    conNueva.conexion().prepare('INSERT INTO alumno (nombre, notas) VALUES (?, ?)').run('Ana', 'x')
  })

  it('si la base configurada no está, avisa y no crea ninguna vacía', () => {
    const usb = carpeta('usb')
    const ubicacion = nuevaUbicacion()
    ubicacion.iniciar()
    ubicacion.moverA(usb)
    ubicacion.cerrar()
    unlinkSync(join(usb, NOMBRE_FICHERO))

    const siguiente = nuevaUbicacion()
    expect(siguiente.iniciar()).toEqual({ tipo: 'ausente', ruta: join(usb, NOMBRE_FICHERO) })
    expect(existsSync(join(usb, NOMBRE_FICHERO))).toBe(false)
    expect(() => siguiente.conexion()).toThrow()
  })

  it('reintentar la encuentra cuando vuelve a estar disponible', () => {
    const usb = carpeta('usb')
    const ubicacion = nuevaUbicacion()
    ubicacion.iniciar()
    ubicacion.conexion().prepare('INSERT INTO alumno (nombre) VALUES (?)').run('Ana')
    ubicacion.moverA(usb)
    ubicacion.cerrar()

    const rutaUsb = join(usb, NOMBRE_FICHERO)
    const guardada = join(raiz, 'fuera-del-usb.sqlite')
    writeFileSync(guardada, readFileSync(rutaUsb))
    unlinkSync(rutaUsb)

    const siguiente = nuevaUbicacion()
    expect(siguiente.iniciar().tipo).toBe('ausente')
    writeFileSync(rutaUsb, readFileSync(guardada))
    expect(siguiente.reintentar()).toEqual({ tipo: 'lista', ruta: rutaUsb })
    expect(nombresAlumnos(siguiente)).toEqual(['Ana'])
  })

  it('una configuración ilegible da error, no una base nueva', () => {
    writeFileSync(join(carpetaDatos, 'configuracion.json'), '{ roto')
    const estado = nuevaUbicacion().iniciar()
    expect(estado.tipo).toBe('error')
    expect(existsSync(join(carpetaDatos, NOMBRE_FICHERO))).toBe(false)
  })
})

describe('cambiar de ubicación', () => {
  it('mueve los datos a una carpeta vacía, pasa a usarlos y conserva el original', () => {
    const destino = carpeta('usb')
    const ubicacion = nuevaUbicacion()
    ubicacion.iniciar()
    ubicacion.conexion().prepare('INSERT INTO alumno (nombre) VALUES (?)').run('Ana')

    const resultado = ubicacion.moverA(destino)

    const rutaNueva = join(destino, NOMBRE_FICHERO)
    expect(resultado).toEqual({ tipo: 'movida', ruta: rutaNueva })
    expect(ubicacion.estado).toEqual({ tipo: 'lista', ruta: rutaNueva })
    expect(rutaConfigurada()).toBe(rutaNueva)
    expect(nombresAlumnos(ubicacion)).toEqual(['Ana'])
    expect(existsSync(join(carpetaDatos, NOMBRE_FICHERO))).toBe(true)
  })

  it('tras mover, lo nuevo se escribe en la base nueva y no en la original', () => {
    const destino = carpeta('usb')
    const ubicacion = nuevaUbicacion()
    ubicacion.iniciar()
    ubicacion.moverA(destino)
    ubicacion.conexion().prepare('INSERT INTO alumno (nombre) VALUES (?)').run('Luis')
    ubicacion.cerrar()

    const original = new UbicacionDatos(carpetaDatos, MIGRACIONES)
    abiertas.push(original)
    original.abrir(join(carpetaDatos, NOMBRE_FICHERO))
    expect(nombresAlumnos(original)).toEqual([])
  })

  it('si en el destino ya hay una base, no la sobrescribe y ofrece abrirla', () => {
    const destino = carpeta('usb')
    const otra = new UbicacionDatos(carpeta('otro-equipo'), MIGRACIONES)
    abiertas.push(otra)
    otra.iniciar()
    otra.conexion().prepare('INSERT INTO alumno (nombre) VALUES (?)').run('Del USB')
    otra.moverA(destino)
    otra.cerrar()

    const ubicacion = nuevaUbicacion()
    ubicacion.iniciar()
    ubicacion.conexion().prepare('INSERT INTO alumno (nombre) VALUES (?)').run('Local')
    const rutaDestino = join(destino, NOMBRE_FICHERO)
    const antes = readFileSync(rutaDestino)

    expect(ubicacion.moverA(destino)).toEqual({ tipo: 'existe', ruta: rutaDestino })
    expect(readFileSync(rutaDestino).equals(antes)).toBe(true)
    expect(nombresAlumnos(ubicacion)).toEqual(['Local'])

    expect(ubicacion.abrirExistente()).toEqual({ tipo: 'abierta', ruta: rutaDestino })
    expect(nombresAlumnos(ubicacion)).toEqual(['Del USB'])
    expect(rutaConfigurada()).toBe(rutaDestino)
  })

  it('mover a la carpeta en la que ya está no hace nada', () => {
    const ubicacion = nuevaUbicacion()
    ubicacion.iniciar()
    expect(ubicacion.moverA(carpetaDatos).tipo).toBe('error')
    expect(ubicacion.estado.tipo).toBe('lista')
  })

  it('abrir un fichero que no es de Ariadne falla y mantiene la base actual', () => {
    const ubicacion = nuevaUbicacion()
    ubicacion.iniciar()
    const falso = join(raiz, 'notas.sqlite')
    writeFileSync(falso, 'esto no es una base de datos')

    const resultado = ubicacion.abrir(falso)

    expect(resultado.tipo).toBe('error')
    expect(ubicacion.estado).toEqual({ tipo: 'lista', ruta: join(carpetaDatos, NOMBRE_FICHERO) })
    expect(rutaConfigurada()).toBe(join(carpetaDatos, NOMBRE_FICHERO))
  })

  it('abrir una base existente desde la pantalla de datos ausentes la deja lista', () => {
    const usb = carpeta('usb')
    const ubicacion = nuevaUbicacion()
    ubicacion.iniciar()
    ubicacion.moverA(usb)
    ubicacion.cerrar()
    const rutaUsb = join(usb, NOMBRE_FICHERO)
    const encontrada = join(carpeta('otra-letra-de-unidad'), NOMBRE_FICHERO)
    writeFileSync(encontrada, readFileSync(rutaUsb))
    unlinkSync(rutaUsb)

    const siguiente = nuevaUbicacion()
    expect(siguiente.iniciar().tipo).toBe('ausente')
    expect(siguiente.abrir(encontrada)).toEqual({ tipo: 'abierta', ruta: encontrada })
    expect(siguiente.estado).toEqual({ tipo: 'lista', ruta: encontrada })
    expect(rutaConfigurada()).toBe(encontrada)
  })
})
