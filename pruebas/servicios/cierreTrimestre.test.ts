import type Database from 'better-sqlite3'
import { beforeEach, describe, expect, it } from 'vitest'
import type { VistaCurso } from '../../src/compartido/ipc'
import { darDeAlta, listarAlumnos } from '../../src/main/servicios/alumnos'
import { cerrarTrimestre, valorarObjetivo, verificacionDeTrimestre } from '../../src/main/servicios/cierre'
import { obtenerCurso } from '../../src/main/servicios/cursos'
import { anadirObjetivo, crearPrograma, programaDeCurso } from '../../src/main/servicios/programas'
import { registrarSesion } from '../../src/main/servicios/sesiones'
import { crearBaseDePrueba } from '../ayudas/baseDePrueba'
import { abrirCursoDePrueba } from '../ayudas/cursoDePrueba'

const HOY = '2026-12-20'

let db: Database.Database
let alumnoId: number
let curso: VistaCurso
let programaId: number

const trimestre = (n: 1 | 2 | 3) => curso.trimestres.find((t) => t.numero === n)!.id
const estado = (n: 1 | 2 | 3) => obtenerCurso(db, curso.id, HOY)!.trimestres.find((t) => t.numero === n)!.estado
const delTrimestre = (n: 1 | 2 | 3) => programaDeCurso(db, curso.id)!.asignaciones.filter((a) => a.numeroTrimestre === n)

function objetivo(enunciado: string, n: 1 | 2 | 3 = 1): number {
  const r = anadirObjetivo(db, programaId, { enunciado, trimestreId: trimestre(n) }, '2026-09-20')
  if (r.tipo !== 'guardado') throw new Error('objetivo fallido')
  return r.programa.asignaciones.find((a) => a.enunciado === enunciado)!.asignacionId
}

beforeEach(() => {
  db = crearBaseDePrueba()
  const alta = darDeAlta(db, { nombre: 'Lucía', apellidos: 'García', fechaNacimiento: null, diagnosticos: null, notas: null }, false, HOY)
  if (alta.tipo !== 'creado') throw new Error('alta fallida')
  alumnoId = alta.alumno.id
  const r = abrirCursoDePrueba(db, alumnoId, {
    curso: '2026/2027',
    nivelEducativo: null,
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
  programaId = p.programa.id
})

describe('cierre del trimestre (T5.4)', () => {
  it('no se puede cerrar mientras quede algo sin valorar', () => {
    objetivo('Mejorar la fluidez lectora')
    objetivo('Mantener la atención')
    expect(cerrarTrimestre(db, trimestre(1), [])).toEqual({ tipo: 'rechazado', mensaje: 'Faltan 2 objetivos por valorar.' })
    expect(estado(1)).toBe('abierto')
  })

  it('al cerrarlo, lo marcado pasa al trimestre siguiente y lo desmarcado se queda', () => {
    const fluidez = objetivo('Mejorar la fluidez lectora')
    const atencion = objetivo('Mantener la atención')
    const vocales = objetivo('Reconocer las vocales')
    valorarObjetivo(db, fluidez, 'no_conseguido', null)
    valorarObjetivo(db, atencion, 'pendiente_desarrollar', null)
    valorarObjetivo(db, vocales, 'conseguido', null)

    expect(cerrarTrimestre(db, trimestre(1), [fluidez])).toEqual({
      tipo: 'cerrado',
      resumen: '1.er trimestre cerrado. Un objetivo pasa al 2.º trimestre.',
      cursoCerrado: false
    })
    expect(estado(1)).toBe('cerrado')
    expect(delTrimestre(2).map((a) => [a.enunciado, a.valoracion, a.arrastrado])).toEqual([['Mejorar la fluidez lectora', 'sin_valorar', true]])
  })

  it('un trimestre sin objetivos se cierra sin más', () => {
    expect(cerrarTrimestre(db, trimestre(1), [])).toMatchObject({ tipo: 'cerrado', resumen: '1.er trimestre cerrado.' })
  })

  it('se cierran en orden', () => {
    expect(cerrarTrimestre(db, trimestre(2), [])).toEqual({ tipo: 'rechazado', mensaje: 'Antes hay que cerrar el 1.er trimestre.' })
    cerrarTrimestre(db, trimestre(1), [])
    expect(cerrarTrimestre(db, trimestre(1), [])).toEqual({ tipo: 'rechazado', mensaje: 'El 1.er trimestre ya está cerrado.' })
    expect(cerrarTrimestre(db, trimestre(2), []).tipo).toBe('cerrado')
  })

  it('cerrar el tercero cierra el curso y el alumno sale de los activos', () => {
    cerrarTrimestre(db, trimestre(1), [])
    cerrarTrimestre(db, trimestre(2), [])
    const id = objetivo('Leer frases cortas', 3)
    valorarObjetivo(db, id, 'no_conseguido', null)

    expect(cerrarTrimestre(db, trimestre(3), [])).toEqual({
      tipo: 'cerrado',
      resumen: '3.er trimestre cerrado: el curso 2026/2027 queda cerrado.',
      cursoCerrado: true
    })
    expect(obtenerCurso(db, curso.id, HOY)!.estado).toBe('cerrado')
    expect(listarAlumnos(db).find((a) => a.id === alumnoId)!.cursoActivo).toBeNull()
  })

  it('si el arrastre no vale, no se cierra nada', () => {
    const vocales = objetivo('Reconocer las vocales')
    valorarObjetivo(db, vocales, 'conseguido', null)
    expect(cerrarTrimestre(db, trimestre(1), [vocales])).toMatchObject({ tipo: 'rechazado' })
    expect(estado(1)).toBe('abierto')
    expect(delTrimestre(2)).toEqual([])
  })

  it('cerrado, ya no se valora ni admite sesiones, y la verificación lo indica', () => {
    const id = objetivo('Mejorar la fluidez lectora')
    valorarObjetivo(db, id, 'conseguido', null)
    cerrarTrimestre(db, trimestre(1), [])

    expect(valorarObjetivo(db, id, 'no_conseguido', null).tipo).toBe('rechazado')
    const sesion = { fecha: '2026-12-21', objetivos: [], estadoAlumno: ['Tranquilo'], respuestaActividades: [], observaciones: null, saludMedicacion: null, falta: false }
    expect(registrarSesion(db, alumnoId, sesion, '2026-12-21').tipo).toBe('invalida')
    expect(verificacionDeTrimestre(db, trimestre(1))).toMatchObject({ abierto: false, cerrable: false })
  })

  it('la verificación dice qué se puede arrastrar y si es el trimestre que toca cerrar', () => {
    const fluidez = objetivo('Mejorar la fluidez lectora')
    const vocales = objetivo('Reconocer las vocales')
    valorarObjetivo(db, fluidez, 'no_conseguido', null)
    valorarObjetivo(db, vocales, 'conseguido', null)

    const v = verificacionDeTrimestre(db, trimestre(1))!
    expect(v).toMatchObject({ cerrable: true, nombreSiguiente: '2.º trimestre', curso: '2026/2027', fechaFin: '2026-12-22' })
    expect(v.objetivos.map((o) => o.arrastrable)).toEqual([true, false])
    expect(verificacionDeTrimestre(db, trimestre(2))!.cerrable).toBe(false)
    expect(obtenerCurso(db, curso.id, HOY)!.trimestreACerrarId).toBe(trimestre(1))
  })
})
