import type { DatosAlumno } from '../dominio/alumno'
import type { Alumno } from '../dominio/entidades'
import type { BaseDatos } from './baseDatos'

interface FilaAlumno {
  id: number
  codigo_interno: string
  nombre: string
  apellidos: string
  fecha_nacimiento: string | null
  diagnosticos: string | null
  notas: string | null
}

function aAlumno(fila: FilaAlumno): Alumno {
  return {
    id: fila.id,
    codigoInterno: fila.codigo_interno,
    nombre: fila.nombre,
    apellidos: fila.apellidos,
    fechaNacimiento: fila.fecha_nacimiento,
    diagnosticos: fila.diagnosticos,
    notas: fila.notas
  }
}

function parametros(datos: DatosAlumno) {
  return {
    nombre: datos.nombre,
    apellidos: datos.apellidos,
    fecha_nacimiento: datos.fechaNacimiento,
    diagnosticos: datos.diagnosticos,
    notas: datos.notas
  }
}

export function ultimoNumeroEntregado(db: BaseDatos): number {
  return (db.prepare('SELECT ultimo FROM secuencia_codigo WHERE id = 1').get() as { ultimo: number }).ultimo
}

export function registrarNumeroEntregado(db: BaseDatos, numero: number): void {
  db.prepare('UPDATE secuencia_codigo SET ultimo = ? WHERE id = 1').run(numero)
}

export function insertarAlumno(db: BaseDatos, codigoInterno: string, datos: DatosAlumno): number {
  const resultado = db
    .prepare(
      `INSERT INTO alumno (codigo_interno, nombre, apellidos, fecha_nacimiento, diagnosticos, notas)
       VALUES (@codigo_interno, @nombre, @apellidos, @fecha_nacimiento, @diagnosticos, @notas)`
    )
    .run({ codigo_interno: codigoInterno, ...parametros(datos) })
  return Number(resultado.lastInsertRowid)
}

/** El código no figura aquí a propósito: no hay forma de cambiarlo desde la aplicación. */
export function actualizarAlumno(db: BaseDatos, id: number, datos: DatosAlumno): boolean {
  const resultado = db
    .prepare(
      `UPDATE alumno
       SET nombre = @nombre, apellidos = @apellidos, fecha_nacimiento = @fecha_nacimiento,
           diagnosticos = @diagnosticos, notas = @notas
       WHERE id = @id`
    )
    .run({ id, ...parametros(datos) })
  return resultado.changes === 1
}

export function obtenerAlumno(db: BaseDatos, id: number): Alumno | null {
  const fila = db.prepare('SELECT * FROM alumno WHERE id = ?').get(id) as FilaAlumno | undefined
  return fila ? aAlumno(fila) : null
}

export function listarAlumnos(db: BaseDatos): Alumno[] {
  const filas = db.prepare('SELECT * FROM alumno').all() as FilaAlumno[]
  return filas.map(aAlumno)
}
