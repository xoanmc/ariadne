import type { AlumnoEnLista, DatosAlumno, FichaAlumno, ResultadoAlta, ResultadoEdicion } from '../../compartido/ipc'
import { claveDeNombre, normalizarDatosAlumno, validarDatosAlumno } from '../dominio/alumno'
import { siguienteCodigo } from '../dominio/codigoInterno'
import type { Fecha } from '../dominio/entidades'
import type { BaseDatos } from '../persistencia/baseDatos'
import * as repositorio from '../persistencia/repositorioAlumnos'
import { cursosActivos } from '../persistencia/repositorioCursos'
import { esId } from './entrada'
import { hoyLocal } from './fecha'

const orden = new Intl.Collator('es', { sensitivity: 'base' })

/** Por nombre, como ella los piensa ("acabo de ver a Lucía"), con orden alfabético del español. */
export function listarAlumnos(db: BaseDatos): AlumnoEnLista[] {
  const activos = cursosActivos(db)
  return repositorio
    .listarAlumnos(db)
    .sort((a, b) => orden.compare(a.nombre, b.nombre) || orden.compare(a.apellidos, b.apellidos) || a.id - b.id)
    .map((alumno) => {
      const curso = activos.get(alumno.id)
      return { ...alumno, cursoActivo: curso ? { curso: curso.curso, nivelEducativo: curso.nivelEducativo } : null }
    })
}

export function obtenerAlumno(db: BaseDatos, id: unknown): FichaAlumno | null {
  return esId(id) ? repositorio.obtenerAlumno(db, id) : null
}

export function darDeAlta(
  db: BaseDatos,
  entrada: Partial<DatosAlumno>,
  confirmarDuplicado = false,
  hoy: Fecha = hoyLocal()
): ResultadoAlta {
  const datos = normalizarDatosAlumno(entrada ?? {})
  const problemas = validarDatosAlumno(datos, hoy)
  if (problemas.length > 0) return { tipo: 'invalido', problemas }

  // Mismo nombre no es un error (puede pasar), pero sí merece una pregunta antes de duplicar a alguien.
  if (!confirmarDuplicado) {
    const clave = claveDeNombre(datos.nombre, datos.apellidos)
    const coincidencias = repositorio
      .listarAlumnos(db)
      .filter((a) => claveDeNombre(a.nombre, a.apellidos) === clave)
    if (coincidencias.length > 0) return { tipo: 'posible_duplicado', coincidencias }
  }

  const id = db.transaction(() => {
    const ultimo = repositorio.ultimoNumeroEntregado(db)
    const nuevoId = repositorio.insertarAlumno(db, siguienteCodigo(ultimo), datos)
    repositorio.registrarNumeroEntregado(db, ultimo + 1)
    return nuevoId
  })()

  return { tipo: 'creado', alumno: repositorio.obtenerAlumno(db, id)! }
}

export function editarAlumno(
  db: BaseDatos,
  id: unknown,
  entrada: Partial<DatosAlumno>,
  hoy: Fecha = hoyLocal()
): ResultadoEdicion {
  if (!esId(id)) return { tipo: 'no_existe' }

  const datos = normalizarDatosAlumno(entrada ?? {})
  const problemas = validarDatosAlumno(datos, hoy)
  if (problemas.length > 0) return { tipo: 'invalido', problemas }

  if (!repositorio.actualizarAlumno(db, id, datos)) return { tipo: 'no_existe' }
  return { tipo: 'guardado', alumno: repositorio.obtenerAlumno(db, id)! }
}
