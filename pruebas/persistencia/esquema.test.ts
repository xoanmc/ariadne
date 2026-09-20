import Database from 'better-sqlite3'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { beforeEach, describe, expect, it } from 'vitest'
import { aplicarMigraciones, leerCatalogo } from '../../src/main/persistencia/migraciones'

const CARPETA = fileURLToPath(new URL('../../recursos/migraciones', import.meta.url))

const MIGRACIONES = leerCatalogo(
  Object.fromEntries(
    readdirSync(CARPETA)
      .filter((f) => f.endsWith('.sql'))
      .map((f) => [f, readFileSync(join(CARPETA, f), 'utf8')])
  )
)

let db: Database.Database

function crearEsquema(): Database.Database {
  const base = new Database(':memory:')
  base.pragma('foreign_keys = ON')
  aplicarMigraciones(base, MIGRACIONES)
  return base
}

function insertar(tabla: string, valores: Record<string, unknown>): number {
  const columnas = Object.keys(valores)
  const sentencia = db.prepare(
    `INSERT INTO ${tabla} (${columnas.join(', ')}) VALUES (${columnas.map((c) => `@${c}`).join(', ')})`
  )
  return Number(sentencia.run(valores).lastInsertRowid)
}

function alumnoConTrimestres(): { alumnoId: number; cursoId: number; trimestres: number[]; programaId: number } {
  const alumnoId = insertar('alumno', { codigo_interno: 'A-01', nombre: 'Ana', apellidos: 'García' })
  const cursoId = insertar('curso_academico', { alumno_id: alumnoId, curso: '2025/2026' })
  const trimestres = [
    insertar('trimestre', { curso_academico_id: cursoId, numero: 1, fecha_inicio: '2025-09-15', fecha_fin: '2025-12-19' }),
    insertar('trimestre', { curso_academico_id: cursoId, numero: 2, fecha_inicio: '2026-01-08', fecha_fin: '2026-03-27' }),
    insertar('trimestre', { curso_academico_id: cursoId, numero: 3, fecha_inicio: '2026-04-07', fecha_fin: '2026-06-19' })
  ]
  const programaId = insertar('programa_intervencion', {
    curso_academico_id: cursoId,
    fecha_creacion: '2025-09-20'
  })
  return { alumnoId, cursoId, trimestres, programaId }
}

function objetivo(programaId: number, enunciado = 'Mejorar la lectura'): number {
  return insertar('objetivo', { programa_id: programaId, enunciado, fecha_creacion: '2025-09-20' })
}

beforeEach(() => {
  db = crearEsquema()
})

describe('creación del esquema', () => {
  it('crea todas las tablas del plan desde cero mediante migraciones', () => {
    const tablas = (
      db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all() as {
        name: string
      }[]
    ).map((t) => t.name)

    expect(tablas).toEqual([
      'acta_reunion',
      'alumno',
      'area',
      'asignacion_trimestral',
      'curso_academico',
      'documento_generado',
      'evaluacion_inicial',
      'objetivo',
      'opcion_catalogo',
      'plantilla',
      'programa_intervencion',
      'sesion',
      'sesion_objetivo',
      'trimestre',
      'version_esquema'
    ])
  })
})

describe('valoración', () => {
  it('acepta exactamente los cuatro valores de la rúbrica', () => {
    const { trimestres, programaId } = alumnoConTrimestres()
    const valores = ['sin_valorar', 'conseguido', 'no_conseguido', 'pendiente_desarrollar']

    valores.forEach((valoracion, i) => {
      insertar('asignacion_trimestral', {
        objetivo_id: objetivo(programaId, `Objetivo ${i}`),
        trimestre_id: trimestres[0],
        valoracion
      })
    })

    expect(db.prepare('SELECT COUNT(*) AS n FROM asignacion_trimestral').get()).toEqual({ n: 4 })
  })

  it('rechaza una valoración inventada', () => {
    const { trimestres, programaId } = alumnoConTrimestres()
    expect(() =>
      insertar('asignacion_trimestral', {
        objetivo_id: objetivo(programaId),
        trimestre_id: trimestres[0],
        valoracion: 'casi_conseguido'
      })
    ).toThrow(/CHECK constraint failed/)
  })

  it('una asignación nueva nace sin valorar', () => {
    const { trimestres, programaId } = alumnoConTrimestres()
    const id = insertar('asignacion_trimestral', { objetivo_id: objetivo(programaId), trimestre_id: trimestres[0] })
    expect(db.prepare('SELECT valoracion FROM asignacion_trimestral WHERE id = ?').get(id)).toEqual({
      valoracion: 'sin_valorar'
    })
  })
})

describe('cadena de arrastre', () => {
  it('enlaza asignaciones de trimestres sucesivos', () => {
    const { trimestres, programaId } = alumnoConTrimestres()
    const objetivoId = objetivo(programaId)
    const primera = insertar('asignacion_trimestral', {
      objetivo_id: objetivoId,
      trimestre_id: trimestres[0],
      valoracion: 'no_conseguido'
    })
    const segunda = insertar('asignacion_trimestral', {
      objetivo_id: objetivoId,
      trimestre_id: trimestres[1],
      asignacion_anterior_id: primera
    })

    expect(db.prepare('SELECT asignacion_anterior_id FROM asignacion_trimestral WHERE id = ?').get(segunda)).toEqual({
      asignacion_anterior_id: primera
    })
  })

  it('no permite que dos asignaciones procedan de la misma anterior', () => {
    const { trimestres, programaId } = alumnoConTrimestres()
    const objetivoId = objetivo(programaId)
    const primera = insertar('asignacion_trimestral', { objetivo_id: objetivoId, trimestre_id: trimestres[0] })
    insertar('asignacion_trimestral', {
      objetivo_id: objetivoId,
      trimestre_id: trimestres[1],
      asignacion_anterior_id: primera
    })

    expect(() =>
      insertar('asignacion_trimestral', {
        objetivo_id: objetivo(programaId, 'Otro objetivo'),
        trimestre_id: trimestres[2],
        asignacion_anterior_id: primera
      })
    ).toThrow(/UNIQUE constraint failed/)
  })

  it('no permite el mismo objetivo dos veces en un trimestre', () => {
    const { trimestres, programaId } = alumnoConTrimestres()
    const objetivoId = objetivo(programaId)
    insertar('asignacion_trimestral', { objetivo_id: objetivoId, trimestre_id: trimestres[0] })

    expect(() => insertar('asignacion_trimestral', { objetivo_id: objetivoId, trimestre_id: trimestres[0] })).toThrow(
      /UNIQUE constraint failed/
    )
  })

  it('la cadena de cursos tampoco se bifurca', () => {
    const alumnoId = insertar('alumno', { codigo_interno: 'A-01', nombre: 'Ana', apellidos: 'García' })
    const anterior = insertar('curso_academico', { alumno_id: alumnoId, curso: '2024/2025' })
    insertar('curso_academico', { alumno_id: alumnoId, curso: '2025/2026', curso_anterior_id: anterior })

    expect(() =>
      insertar('curso_academico', { alumno_id: alumnoId, curso: '2026/2027', curso_anterior_id: anterior })
    ).toThrow(/UNIQUE constraint failed/)
  })
})

describe('curso y trimestres', () => {
  it('solo admite los estados previstos', () => {
    const { cursoId, trimestres } = alumnoConTrimestres()
    expect(() => db.prepare('UPDATE curso_academico SET estado = ? WHERE id = ?').run('archivado', cursoId)).toThrow(
      /CHECK constraint failed/
    )
    expect(() => db.prepare('UPDATE trimestre SET estado = ? WHERE id = ?').run('a_medias', trimestres[0])).toThrow(
      /CHECK constraint failed/
    )
  })

  it('un curso nace activo y un trimestre nace abierto', () => {
    const { cursoId, trimestres } = alumnoConTrimestres()
    expect(db.prepare('SELECT estado FROM curso_academico WHERE id = ?').get(cursoId)).toEqual({ estado: 'activo' })
    expect(db.prepare('SELECT estado FROM trimestre WHERE id = ?').get(trimestres[0])).toEqual({ estado: 'abierto' })
  })

  it('no hay un cuarto trimestre ni dos con el mismo número', () => {
    const { cursoId } = alumnoConTrimestres()
    expect(() =>
      insertar('trimestre', { curso_academico_id: cursoId, numero: 4, fecha_inicio: '2026-06-20', fecha_fin: '2026-07-01' })
    ).toThrow(/CHECK constraint failed/)
    expect(() =>
      insertar('trimestre', { curso_academico_id: cursoId, numero: 2, fecha_inicio: '2026-01-08', fecha_fin: '2026-03-27' })
    ).toThrow(/UNIQUE constraint failed/)
  })

  it('rechaza un trimestre que acaba antes de empezar', () => {
    const { cursoId } = alumnoConTrimestres()
    db.prepare('DELETE FROM trimestre WHERE curso_academico_id = ?').run(cursoId)
    expect(() =>
      insertar('trimestre', { curso_academico_id: cursoId, numero: 1, fecha_inicio: '2025-12-19', fecha_fin: '2025-09-15' })
    ).toThrow(/CHECK constraint failed/)
  })

  it('rechaza fechas que no son fechas', () => {
    const { cursoId } = alumnoConTrimestres()
    db.prepare('DELETE FROM trimestre WHERE curso_academico_id = ?').run(cursoId)
    expect(() =>
      insertar('trimestre', { curso_academico_id: cursoId, numero: 1, fecha_inicio: '15/09/2025', fecha_fin: '2025-12-19' })
    ).toThrow(/CHECK constraint failed/)
  })

  it('un alumno no repite curso académico', () => {
    const { alumnoId } = alumnoConTrimestres()
    expect(() => insertar('curso_academico', { alumno_id: alumnoId, curso: '2025/2026' })).toThrow(
      /UNIQUE constraint failed/
    )
  })

  it('hay como mucho una evaluación inicial y un programa por curso', () => {
    const { cursoId } = alumnoConTrimestres()
    insertar('evaluacion_inicial', { curso_academico_id: cursoId, fecha: '2025-09-18', contenido: 'Lectura lenta' })

    expect(() =>
      insertar('evaluacion_inicial', { curso_academico_id: cursoId, fecha: '2025-09-25', contenido: 'Otra' })
    ).toThrow(/UNIQUE constraint failed/)
    expect(() => insertar('programa_intervencion', { curso_academico_id: cursoId, fecha_creacion: '2025-09-20' })).toThrow(
      /UNIQUE constraint failed/
    )
  })
})

describe('integridad referencial', () => {
  it('no admite una sesión en un trimestre que no existe', () => {
    const { alumnoId } = alumnoConTrimestres()
    expect(() => insertar('sesion', { alumno_id: alumnoId, trimestre_id: 9999, fecha: '2025-10-01' })).toThrow(
      /FOREIGN KEY constraint failed/
    )
  })

  it('no admite un alumno sin código interno', () => {
    expect(() => insertar('alumno', { codigo_interno: '  ', nombre: 'Ana', apellidos: 'García' })).toThrow(
      /CHECK constraint failed/
    )
  })

  it('no admite dos alumnos con el mismo código interno', () => {
    insertar('alumno', { codigo_interno: 'A-01', nombre: 'Ana', apellidos: 'García' })
    expect(() => insertar('alumno', { codigo_interno: 'A-01', nombre: 'Luis', apellidos: 'Pérez' })).toThrow(
      /UNIQUE constraint failed/
    )
  })

  it('al borrar una sesión se llevan sus objetivos trabajados, pero los objetivos siguen', () => {
    const { alumnoId, trimestres, programaId } = alumnoConTrimestres()
    const objetivoId = objetivo(programaId)
    const sesionId = insertar('sesion', { alumno_id: alumnoId, trimestre_id: trimestres[0], fecha: '2025-10-01' })
    insertar('sesion_objetivo', { sesion_id: sesionId, objetivo_id: objetivoId })

    db.prepare('DELETE FROM sesion WHERE id = ?').run(sesionId)

    expect(db.prepare('SELECT COUNT(*) AS n FROM sesion_objetivo').get()).toEqual({ n: 0 })
    expect(db.prepare('SELECT COUNT(*) AS n FROM objetivo').get()).toEqual({ n: 1 })
  })

  it('no deja borrar un objetivo que aparece en una sesión', () => {
    const { alumnoId, trimestres, programaId } = alumnoConTrimestres()
    const objetivoId = objetivo(programaId)
    const sesionId = insertar('sesion', { alumno_id: alumnoId, trimestre_id: trimestres[0], fecha: '2025-10-01' })
    insertar('sesion_objetivo', { sesion_id: sesionId, objetivo_id: objetivoId })

    expect(() => db.prepare('DELETE FROM objetivo WHERE id = ?').run(objetivoId)).toThrow(
      /FOREIGN KEY constraint failed/
    )
  })
})

describe('catálogos y documentos', () => {
  it('el vocabulario solo tiene las dos categorías del registro rápido', () => {
    insertar('opcion_catalogo', { categoria: 'estado_alumno', texto: 'Tranquilo' })
    insertar('opcion_catalogo', { categoria: 'respuesta_actividades', texto: 'Participativa' })

    expect(() => insertar('opcion_catalogo', { categoria: 'tiempo_atmosferico', texto: 'Lluvioso' })).toThrow(
      /CHECK constraint failed/
    )
  })

  it('una opción de vocabulario no se repite dentro de su categoría', () => {
    insertar('opcion_catalogo', { categoria: 'estado_alumno', texto: 'Tranquilo' })
    insertar('opcion_catalogo', { categoria: 'respuesta_actividades', texto: 'Tranquilo' })

    expect(() => insertar('opcion_catalogo', { categoria: 'estado_alumno', texto: 'Tranquilo' })).toThrow(
      /UNIQUE constraint failed/
    )
  })

  it('las opciones y las áreas nacen activas y solo admiten sí o no', () => {
    const opcionId = insertar('opcion_catalogo', { categoria: 'estado_alumno', texto: 'Tranquilo' })
    insertar('area', { nombre: 'Lenguaje' })

    expect(db.prepare('SELECT activa FROM opcion_catalogo WHERE id = ?').get(opcionId)).toEqual({ activa: 1 })
    expect(() => db.prepare('UPDATE area SET activa = 2 WHERE nombre = ?').run('Lenguaje')).toThrow(
      /CHECK constraint failed/
    )
  })

  it('solo hay una plantilla activa por tipo de documento', () => {
    insertar('plantilla', { tipo_documento: 'informe_trimestral', ruta_fichero: 'informe-v1.docx' })

    expect(() => insertar('plantilla', { tipo_documento: 'informe_trimestral', ruta_fichero: 'informe-v2.docx' })).toThrow(
      /UNIQUE constraint failed/
    )

    db.prepare('UPDATE plantilla SET activa = 0 WHERE ruta_fichero = ?').run('informe-v1.docx')
    expect(() => insertar('plantilla', { tipo_documento: 'informe_trimestral', ruta_fichero: 'informe-v2.docx' })).not.toThrow()
  })

  it('los documentos generados solo son de los seis tipos que ella usa', () => {
    const { alumnoId, cursoId, trimestres } = alumnoConTrimestres()
    const tipos = ['diario', 'evaluacion_inicial', 'programa', 'informe_trimestral', 'acta_reunion', 'informe_externo']

    tipos.forEach((tipo) => {
      insertar('documento_generado', {
        tipo,
        alumno_id: alumnoId,
        curso_academico_id: cursoId,
        trimestre_id: tipo === 'informe_trimestral' ? trimestres[0] : null,
        fecha: '2025-12-19'
      })
    })

    expect(() =>
      insertar('documento_generado', {
        tipo: 'informe_de_prueba',
        alumno_id: alumnoId,
        curso_academico_id: cursoId,
        fecha: '2025-12-19'
      })
    ).toThrow(/CHECK constraint failed/)
  })
})
