import type Database from 'better-sqlite3'
import { beforeEach, describe, expect, it } from 'vitest'
import type { DatosSesion, VistaCurso } from '../../src/compartido/ipc'
import { darDeAlta } from '../../src/main/servicios/alumnos'
import { cerrarTrimestre, valorarObjetivo } from '../../src/main/servicios/cierre'
import { exportacionDeTrimestre, exportacionesDeTodos, resumenParaExportarTodos } from '../../src/main/servicios/exportacion'
import { anadirObjetivo, crearPrograma } from '../../src/main/servicios/programas'
import { registrarSesion } from '../../src/main/servicios/sesiones'
import { crearBaseDePrueba } from '../ayudas/baseDePrueba'
import { abrirCursoDePrueba } from '../ayudas/cursoDePrueba'

let db: Database.Database
let curso: VistaCurso
let alumnoId: number
let fluidez: { asignacionId: number; objetivoId: number }

const trimestre = (n: 1 | 2 | 3) => curso.trimestres.find((t) => t.numero === n)!.id
const sesion = (fecha: string, extra: Partial<DatosSesion> = {}): DatosSesion => ({
  fecha,
  objetivos: [],
  estadoAlumno: ['Tranquilo'],
  respuestaActividades: [],
  observaciones: null,
  saludMedicacion: null,
  falta: false,
  ...extra
})

beforeEach(() => {
  db = crearBaseDePrueba()
  const alta = darDeAlta(db, { nombre: 'Lucía', apellidos: 'García Pérez', fechaNacimiento: null, diagnosticos: null, notas: null }, false, '2026-09-20')
  if (alta.tipo !== 'creado') throw new Error('alta fallida')
  alumnoId = alta.alumno.id
  const r = abrirCursoDePrueba(db, alumnoId, {
    curso: '2026/2027',
    nivelEducativo: '3.º de Primaria',
    periodos: [
      { numero: 1, fechaInicio: '2026-09-10', fechaFin: '2026-12-22' },
      { numero: 2, fechaInicio: '2027-01-08', fechaFin: '2027-03-26' },
      { numero: 3, fechaInicio: '2027-04-06', fechaFin: '2027-06-23' }
    ]
  })
  if (r.tipo !== 'guardado') throw new Error('apertura fallida')
  curso = r.curso
  const p = crearPrograma(db, curso.id, null, [], '2026-09-20')
  if (p.tipo !== 'guardado') throw new Error('programa fallido')
  const o = anadirObjetivo(db, p.programa.id, { enunciado: 'Mejorar la fluidez lectora', trimestreId: trimestre(1) }, '2026-09-20')
  if (o.tipo !== 'guardado') throw new Error('objetivo fallido')
  fluidez = o.programa.asignaciones[0]
})

describe('exportación del trimestre en el servicio (T6.1)', () => {
  it('recoge el trimestre de la base: objetivos con su valoración y todas sus sesiones', () => {
    registrarSesion(db, alumnoId, sesion('2026-10-06', { objetivos: [fluidez.objetivoId], observaciones: 'Leyó el cuento' }), '2026-12-20')
    registrarSesion(db, alumnoId, sesion('2026-10-13', { falta: true, estadoAlumno: [], observaciones: 'Enfermo' }), '2026-12-20')
    valorarObjetivo(db, fluidez.asignacionId, 'no_conseguido', 'Aún silabea')
    cerrarTrimestre(db, trimestre(1), [])

    const r = exportacionDeTrimestre(db, trimestre(1), '2026-12-23')!
    expect(r.nombreFichero).toBe('Lucía García Pérez - 2026-2027 - 1.er trimestre.txt')
    expect(r.texto).toContain('Alumno:      Lucía García Pérez (A-01)')
    expect(r.texto).toContain('Sesiones:    1 sesión y 1 falta')
    expect(r.texto).toContain('* Mejorar la fluidez lectora\r\n    Valoración: no conseguido\r\n    Trabajado en 1 sesión\r\n    Comentario: Aún silabea')
    expect(r.texto).toContain('Martes, 6 de octubre de 2026\r\n    Estado: Tranquilo\r\n    Objetivos trabajados: Mejorar la fluidez lectora\r\n    Observaciones: Leyó el cuento')
    expect(r.texto).toContain('Martes, 13 de octubre de 2026: NO ACUDIÓ\r\n    Motivo: Enfermo')
    expect(r.texto).not.toContain('sigue abierto')
  })

  it('se puede exportar antes de cerrar, y el fichero lo advierte', () => {
    const r = exportacionDeTrimestre(db, trimestre(1), '2026-10-14')!
    expect(r.texto).toContain('El trimestre sigue abierto')
    expect(r.texto).toContain('Valoración: sin valorar')
  })

  it('solo lleva las sesiones de ese trimestre', () => {
    registrarSesion(db, alumnoId, sesion('2026-10-06', { observaciones: 'Del primero' }), '2027-02-10')
    registrarSesion(db, alumnoId, sesion('2027-02-10', { observaciones: 'Del segundo' }), '2027-02-10')
    const r = exportacionDeTrimestre(db, trimestre(2), '2027-02-11')!
    expect(r.texto).toContain('Del segundo')
    expect(r.texto).not.toContain('Del primero')
    expect(r.nombreFichero).toBe('Lucía García Pérez - 2026-2027 - 2.º trimestre.txt')
  })

  it('un trimestre que no existe no se exporta', () => {
    expect(exportacionDeTrimestre(db, 999)).toBeNull()
    expect(exportacionDeTrimestre(db, 'uno')).toBeNull()
  })
})

describe('exportar el trimestre de todos (T6.2)', () => {
  function otroAlumno(nombre: string, apellidos: string, abrir = true): number {
    const alta = darDeAlta(db, { nombre, apellidos, fechaNacimiento: null, diagnosticos: null, notas: null }, true, '2026-09-20')
    if (alta.tipo !== 'creado') throw new Error('alta fallida')
    if (abrir) abrirCursoDePrueba(db, alta.alumno.id, { curso: '2026/2027', nivelEducativo: null })
    return alta.alumno.id
  }

  it('un fichero por cada alumno con curso activo, del trimestre elegido y ordenados por apellidos', () => {
    otroAlumno('Mario', 'Ruiz Vega')
    otroAlumno('Ana', 'Álvarez Gil')
    otroAlumno('Leo', 'Sanz', false)

    const ficheros = exportacionesDeTodos(db, 2, '2027-03-27')
    expect(ficheros.map((f) => f.nombreFichero)).toEqual([
      'Ana Álvarez Gil - 2026-2027 - 2.º trimestre.txt',
      'Lucía García Pérez - 2026-2027 - 2.º trimestre.txt',
      'Mario Ruiz Vega - 2026-2027 - 2.º trimestre.txt'
    ])
    expect(ficheros[1].texto).toContain('Alumno:      Lucía García Pérez (A-01)')
  })

  it('cada fichero lleva solo lo de su alumno', () => {
    const mario = otroAlumno('Mario', 'Ruiz Vega')
    registrarSesion(db, mario, sesion('2026-10-06', { observaciones: 'Sesión de Mario' }), '2026-12-20')
    const [lucia, deMario] = exportacionesDeTodos(db, 1, '2026-12-23')
    expect(deMario.texto).toContain('Sesión de Mario')
    expect(lucia.texto).not.toContain('Sesión de Mario')
  })

  it('un trimestre que no es 1, 2 o 3 no exporta nada', () => {
    expect(exportacionesDeTodos(db, 4)).toEqual([])
    expect(exportacionesDeTodos(db, '1')).toEqual([])
  })

  it('propone el trimestre según la fecha y cuenta los alumnos activos', () => {
    otroAlumno('Leo', 'Sanz', false)
    expect(resumenParaExportarTodos(db, '2026-11-15')).toEqual({ alumnos: 1, trimestre: 1 })
    expect(resumenParaExportarTodos(db, '2026-12-28')).toEqual({ alumnos: 1, trimestre: 1 })
    expect(resumenParaExportarTodos(db, '2027-02-01')).toEqual({ alumnos: 1, trimestre: 2 })
  })
})
