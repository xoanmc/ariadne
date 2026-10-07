import type Database from 'better-sqlite3'
import { beforeEach, describe, expect, it } from 'vitest'
import type { DatosSesion, VistaCurso } from '../../src/compartido/ipc'
import { darDeAlta } from '../../src/main/servicios/alumnos'
import { abrirCurso } from '../../src/main/servicios/cursos'
import { anadirObjetivo, crearPrograma, moverObjetivo, programaDeCurso, quitarObjetivo } from '../../src/main/servicios/programas'
import { objetivosParaSesion, registrarSesion } from '../../src/main/servicios/sesiones'
import { crearBaseDePrueba } from '../ayudas/baseDePrueba'

const HOY = '2027-02-15'

let db: Database.Database
let alumnoId: number
let curso: VistaCurso

function alta(nombre: string): number {
  const r = darDeAlta(db, { nombre, apellidos: 'García', fechaNacimiento: null, diagnosticos: null, notas: null }, true, HOY)
  if (r.tipo !== 'creado') throw new Error('alta fallida')
  return r.alumno.id
}

function abrir(id: number): VistaCurso {
  const r = abrirCurso(db, id, {
    curso: '2026/2027',
    nivelEducativo: null,
    periodos: [
      { numero: 1, fechaInicio: '2026-09-10', fechaFin: '2026-12-22' },
      { numero: 2, fechaInicio: '2027-01-08', fechaFin: '2027-03-26' },
      { numero: 3, fechaInicio: '2027-04-06', fechaFin: '2027-06-23' }
    ]
  })
  if (r.tipo !== 'guardado') throw new Error('apertura fallida')
  return r.curso
}

function sesion(extra: Partial<DatosSesion> = {}): DatosSesion {
  return {
    fecha: '2027-02-10',
    objetivos: [],
    estadoAlumno: ['Cansado', 'Inquieto'],
    respuestaActividades: ['Participa'],
    observaciones: null,
    incidencias: null,
    saludMedicacion: null,
    ...extra
  }
}

const guardadas = () =>
  db.prepare('SELECT alumno_id, trimestre_id, fecha, estado_alumno, respuesta_actividades, observaciones FROM sesion').all()

beforeEach(() => {
  db = crearBaseDePrueba()
  alumnoId = alta('Lucía')
  curso = abrir(alumnoId)
})

describe('registro de sesión', () => {
  it('queda guardada con el trimestre correcto sin que ella lo elija', () => {
    const resultado = registrarSesion(db, alumnoId, sesion({ observaciones: 'Le costó arrancar' }), HOY)

    expect(resultado).toMatchObject({ tipo: 'registrada', resumen: 'Sesión registrada: Lucía García, 2.º trimestre.' })
    expect(guardadas()).toEqual([
      {
        alumno_id: alumnoId,
        trimestre_id: curso.trimestres.find((t) => t.numero === 2)!.id,
        fecha: '2027-02-10',
        estado_alumno: 'Cansado, Inquieto',
        respuesta_actividades: 'Participa',
        observaciones: 'Le costó arrancar'
      }
    ])
  })

  it('el trimestre sale del curso de ese alumno, nunca del de otro', () => {
    const mario = alta('Mario')
    const cursoMario = abrir(mario)
    registrarSesion(db, mario, sesion(), HOY)

    const [guardada] = guardadas() as { alumno_id: number; trimestre_id: number }[]
    expect(guardada.alumno_id).toBe(mario)
    expect(cursoMario.trimestres.map((t) => t.id)).toContain(guardada.trimestre_id)
  })

  it('vale con solo las observaciones, o con solo una opción', () => {
    expect(registrarSesion(db, alumnoId, sesion({ estadoAlumno: [], respuestaActividades: [], observaciones: 'Bien' }), HOY).tipo).toBe('registrada')
    expect(registrarSesion(db, alumnoId, sesion({ respuestaActividades: [] }), HOY).tipo).toBe('registrada')
  })

  it('una sesión vacía no se registra', () => {
    const r = registrarSesion(db, alumnoId, sesion({ estadoAlumno: [], respuestaActividades: [] }), HOY)
    expect(r).toEqual({
      tipo: 'invalida',
      problemas: [{ campo: 'contenido', mensaje: 'Marca alguna opción o escribe algo sobre la sesión.' }]
    })
    expect(guardadas()).toEqual([])
  })

  it('no admite una fecha futura', () => {
    const r = registrarSesion(db, alumnoId, sesion({ fecha: '2027-02-16' }), HOY)
    expect(r.tipo === 'invalida' && r.problemas[0].mensaje).toMatch(/posterior a hoy/)
  })

  it('una fecha en vacaciones se avisa en lugar de colocarla en silencio', () => {
    const r = registrarSesion(db, alumnoId, sesion({ fecha: '2026-12-28' }), HOY)
    expect(r).toEqual({
      tipo: 'invalida',
      problemas: [{ campo: 'fecha', mensaje: 'Esa fecha cae en vacaciones, entre el 1.er trimestre y el 2.º trimestre: revisa la fecha.' }]
    })
  })

  it('una fecha fuera del curso también', () => {
    const r = registrarSesion(db, alumnoId, sesion({ fecha: '2026-08-20' }), HOY)
    expect(r.tipo === 'invalida' && r.problemas[0].mensaje).toMatch(/anterior al primer trimestre/)
  })

  it('no se registra en un trimestre ya cerrado', () => {
    db.prepare("UPDATE trimestre SET estado = 'cerrado' WHERE id = ?").run(curso.trimestres[0].id)
    const r = registrarSesion(db, alumnoId, sesion({ fecha: '2026-10-05' }), HOY)
    expect(r.tipo === 'invalida' && r.problemas[0].mensaje).toMatch(/ya está cerrado/)
  })

  it('un alumno sin curso abierto no puede registrar sesiones', () => {
    const sinCurso = alta('Ana')
    expect(registrarSesion(db, sinCurso, sesion(), HOY)).toEqual({
      tipo: 'rechazada',
      mensaje: 'Ana no tiene ahora un curso abierto: ábreselo desde su ficha.'
    })
  })

  it('las opciones repetidas o vacías no se guardan dos veces', () => {
    registrarSesion(db, alumnoId, sesion({ estadoAlumno: ['Cansado', ' Cansado ', ''] }), HOY)
    expect((guardadas() as { estado_alumno: string }[])[0].estado_alumno).toBe('Cansado')
  })
})

describe('objetivos trabajados en la sesión (T4.3)', () => {
  const trimestre = (n: 1 | 2 | 3) => curso.trimestres.find((t) => t.numero === n)!.id

  function objetivos() {
    const programa = crearPrograma(db, curso.id, null, [], HOY)
    if (programa.tipo !== 'guardado') throw new Error('programa fallido')
    const id = (enunciado: string, n: 1 | 2 | 3) => {
      const r = anadirObjetivo(db, programa.programa.id, { enunciado, trimestreId: trimestre(n) }, HOY)
      if (r.tipo !== 'guardado') throw new Error('objetivo fallido')
      return r.programa.asignaciones.find((a) => a.enunciado === enunciado)!.objetivoId
    }
    return { fluidez: id('Mejorar la fluidez lectora', 2), atencion: id('Mantener la atención', 2), vocales: id('Reconocer las vocales', 3) }
  }

  const asociados = () => (db.prepare('SELECT objetivo_id FROM sesion_objetivo ORDER BY objetivo_id').all() as { objetivo_id: number }[]).map((f) => f.objetivo_id)

  it('se ofrecen solo los objetivos del trimestre en el que cae la fecha', () => {
    const { fluidez, atencion } = objetivos()
    expect(objetivosParaSesion(db, alumnoId, '2027-02-10')).toEqual({
      trimestre: '2.º trimestre',
      objetivos: [
        { objetivoId: fluidez, enunciado: 'Mejorar la fluidez lectora', arrastrado: false },
        { objetivoId: atencion, enunciado: 'Mantener la atención', arrastrado: false }
      ]
    })
    expect(objetivosParaSesion(db, alumnoId, '2027-05-10')?.objetivos.map((o) => o.enunciado)).toEqual(['Reconocer las vocales'])
  })

  it('en vacaciones no se ofrece ninguno', () => {
    objetivos()
    expect(objetivosParaSesion(db, alumnoId, '2026-12-28')).toBeNull()
  })

  it('se marcan objetivos y la asociación queda guardada', () => {
    const { fluidez, atencion } = objetivos()
    expect(registrarSesion(db, alumnoId, sesion({ objetivos: [fluidez, atencion] }), HOY).tipo).toBe('registrada')
    expect(asociados()).toEqual([fluidez, atencion].sort((a, b) => a - b))
  })

  it('es opcional: sin objetivos la sesión se registra igual', () => {
    objetivos()
    expect(registrarSesion(db, alumnoId, sesion({ objetivos: [] }), HOY).tipo).toBe('registrada')
    expect(asociados()).toEqual([])
  })

  it('no admite un objetivo de otro trimestre, y entonces no guarda la sesión', () => {
    const { vocales } = objetivos()
    const r = registrarSesion(db, alumnoId, sesion({ objetivos: [vocales] }), HOY)
    expect(r).toEqual({ tipo: 'rechazada', mensaje: 'Alguno de los objetivos marcados no es del 2.º trimestre de este alumno.' })
    expect(db.prepare('SELECT COUNT(*) AS n FROM sesion').get()).toEqual({ n: 0 })
  })

  it('una vez trabajado en una sesión, el objetivo ya no se puede quitar del programa', () => {
    const { fluidez } = objetivos()
    registrarSesion(db, alumnoId, sesion({ objetivos: [fluidez] }), HOY)
    expect(quitarObjetivo(db, fluidez, HOY)).toEqual({ tipo: 'rechazado', mensaje: 'Tiene sesiones asociadas.' })
  })

  it('una vez trabajado en una sesión del trimestre, tampoco se mueve a otro', () => {
    const { fluidez, atencion } = objetivos()
    registrarSesion(db, alumnoId, sesion({ objetivos: [fluidez] }), HOY)
    const asignacion = (id: number) => programaDeCurso(db, curso.id)!.asignaciones.find((a) => a.objetivoId === id)!

    expect(asignacion(fluidez).puedeMoverse).toBe(false)
    expect(moverObjetivo(db, asignacion(fluidez).asignacionId, trimestre(3), HOY)).toEqual({
      tipo: 'rechazado',
      mensaje: 'Ya se trabajó en alguna sesión de este trimestre, así que no se mueve.'
    })
    expect(asignacion(atencion).puedeMoverse).toBe(true)
  })
})
