import type Database from 'better-sqlite3'
import { beforeEach, describe, expect, it } from 'vitest'
import type { CategoriaCatalogo, ListaDeOpciones } from '../../src/compartido/ipc'
import { activarOpcion, anadirOpcion, listarCatalogo, moverOpcion, renombrarOpcion } from '../../src/main/servicios/catalogo'
import { crearBaseDePrueba } from '../ayudas/baseDePrueba'

let db: Database.Database

const lista = (listas: ListaDeOpciones[], categoria: CategoriaCatalogo) => listas.find((l) => l.categoria === categoria)!
const textos = (categoria: CategoriaCatalogo) => lista(listarCatalogo(db), categoria).opciones.map((o) => o.texto)

function anadir(categoria: CategoriaCatalogo, ...nuevas: string[]) {
  for (const texto of nuevas) {
    const r = anadirOpcion(db, categoria, texto)
    if (r.tipo !== 'guardado') throw new Error(r.mensaje)
  }
  return lista(listarCatalogo(db), categoria).opciones
}

describe('opciones iniciales', () => {
  it('la aplicación trae un punto de partida que ella puede cambiar', () => {
    db = crearBaseDePrueba()
    expect(textos('estado_alumno')).toEqual(['Tranquilo', 'Cansado', 'Inquieto'])
    expect(textos('respuesta_actividades')).toEqual(['Participa', 'Necesita apoyo', 'Se distrae'])
    expect(lista(listarCatalogo(db), 'estado_alumno').opciones.every((o) => o.activa)).toBe(true)
  })
})

beforeEach(() => {
  db = crearBaseDePrueba()
  // El resto de pruebas mira la mecánica de las listas, así que parten de listas vacías
  db.prepare('DELETE FROM opcion_catalogo').run()
})

describe('opciones del registro', () => {
  it('se añaden al final de su lista, cada una en la suya', () => {
    anadir('estado_alumno', 'Tranquilo', 'Inquieto')
    anadir('respuesta_actividades', 'Participa')

    expect(textos('estado_alumno')).toEqual(['Tranquilo', 'Inquieto'])
    expect(textos('respuesta_actividades')).toEqual(['Participa'])
  })

  it('no admite repetir una opción en la misma lista, aunque cambien mayúsculas o acentos', () => {
    anadir('estado_alumno', 'Cansado')
    expect(anadirOpcion(db, 'estado_alumno', '  cansádo ')).toEqual({ tipo: 'invalido', mensaje: 'Ya existe la opción «Cansado».' })
    expect(anadirOpcion(db, 'respuesta_actividades', 'Cansado').tipo).toBe('guardado')
  })

  it('si la repetida está desactivada, sugiere reactivarla', () => {
    const [cansado] = anadir('estado_alumno', 'Cansado')
    activarOpcion(db, cansado.id, false)
    const r = anadirOpcion(db, 'estado_alumno', 'cansado')
    expect(r.tipo === 'invalido' && r.mensaje).toMatch(/desactivada: puedes reactivarla/)
  })

  it('no admite una opción vacía ni demasiado larga', () => {
    expect(anadirOpcion(db, 'estado_alumno', '   ').tipo).toBe('invalido')
    expect(anadirOpcion(db, 'estado_alumno', 'x'.repeat(61)).tipo).toBe('invalido')
  })

  it('se ordenan subiendo y bajando', () => {
    const [a, , c] = anadir('estado_alumno', 'Tranquilo', 'Inquieto', 'Cansado')
    moverOpcion(db, c.id, 'arriba')
    expect(textos('estado_alumno')).toEqual(['Tranquilo', 'Cansado', 'Inquieto'])
    moverOpcion(db, a.id, 'abajo')
    expect(textos('estado_alumno')).toEqual(['Cansado', 'Tranquilo', 'Inquieto'])
  })

  it('subir la primera o bajar la última no hace nada', () => {
    const [a, b] = anadir('estado_alumno', 'Tranquilo', 'Inquieto')
    moverOpcion(db, a.id, 'arriba')
    moverOpcion(db, b.id, 'abajo')
    expect(textos('estado_alumno')).toEqual(['Tranquilo', 'Inquieto'])
  })

  it('se desactivan y se reactivan sin perderse', () => {
    const [a] = anadir('estado_alumno', 'Tranquilo')
    activarOpcion(db, a.id, false)
    expect(lista(listarCatalogo(db), 'estado_alumno').opciones).toEqual([{ id: a.id, texto: 'Tranquilo', activa: false }])
    activarOpcion(db, a.id, true)
    expect(lista(listarCatalogo(db), 'estado_alumno').opciones[0].activa).toBe(true)
  })

  it('se puede corregir el texto, pero no para repetir otra', () => {
    const [a] = anadir('estado_alumno', 'Tranqilo', 'Inquieto')
    expect(renombrarOpcion(db, a.id, 'Tranquilo').tipo).toBe('guardado')
    expect(renombrarOpcion(db, a.id, 'tranquilo').tipo).toBe('guardado')
    expect(renombrarOpcion(db, a.id, 'Inquieto').tipo).toBe('invalido')
    expect(textos('estado_alumno')).toEqual(['tranquilo', 'Inquieto'])
  })

  it('una lista o una opción que no existen se dicen claramente', () => {
    expect(anadirOpcion(db, 'tiempo', 'Lluvioso')).toEqual({ tipo: 'invalido', mensaje: 'Esa lista no existe.' })
    expect(renombrarOpcion(db, 999, 'x').tipo).toBe('invalido')
    expect(moverOpcion(db, 999, 'arriba').tipo).toBe('invalido')
  })
})
