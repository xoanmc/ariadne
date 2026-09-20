import { copyFileSync, existsSync, renameSync, unlinkSync } from 'node:fs'
import { join, resolve } from 'node:path'
import type { Copia, EstadoDatos, ResultadoCambio, ResultadoCopia, ResultadoRestauracion } from '../../compartido/ipc'
import { abrirBaseExistente, copiarBase, crearBase, validarBase, type BaseDatos } from '../persistencia/baseDatos'
import { guardarConfiguracion, leerConfiguracion } from '../persistencia/configuracion'
import { crearCopia, listarCopias, rotarCopias } from '../persistencia/copias'
import type { Migracion } from '../persistencia/migraciones'

export const NOMBRE_FICHERO = 'ariadne.sqlite'

function mensajeDe(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

export class UbicacionDatos {
  private db: BaseDatos | null = null
  private estadoActual: EstadoDatos
  private rutaExistentePendiente: string | null = null

  constructor(
    private readonly carpetaDatos: string,
    private readonly migraciones: Migracion[]
  ) {
    this.estadoActual = { tipo: 'ausente', ruta: this.rutaPorDefecto }
  }

  get rutaPorDefecto(): string {
    return join(this.carpetaDatos, NOMBRE_FICHERO)
  }

  private get rutaConfiguracion(): string {
    return join(this.carpetaDatos, 'configuracion.json')
  }

  get estado(): EstadoDatos {
    return this.estadoActual
  }

  conexion(): BaseDatos {
    if (!this.db) throw new Error('La base de datos no está abierta')
    return this.db
  }

  iniciar(): EstadoDatos {
    let configuracion
    try {
      configuracion = leerConfiguracion(this.rutaConfiguracion)
    } catch (error) {
      return (this.estadoActual = { tipo: 'error', ruta: this.rutaConfiguracion, mensaje: mensajeDe(error) })
    }

    // Solo el primer arranque crea una base nueva. Después, si falta, se avisa: nunca se crea una vacía en silencio.
    if (!configuracion) {
      return this.primerArranque()
    }
    return this.conectar(configuracion.rutaBaseDatos)
  }

  reintentar(): EstadoDatos {
    if (this.estadoActual.tipo === 'lista') return this.estadoActual
    return this.iniciar()
  }

  moverA(carpeta: string): ResultadoCambio {
    if (!this.db || this.estadoActual.tipo !== 'lista') {
      return { tipo: 'error', mensaje: 'No hay ninguna base abierta que mover.' }
    }
    const destino = join(carpeta, NOMBRE_FICHERO)
    if (resolve(destino) === resolve(this.estadoActual.ruta)) {
      return { tipo: 'error', mensaje: 'Tus datos ya están en esa carpeta.' }
    }
    if (existsSync(destino)) {
      this.rutaExistentePendiente = destino
      return { tipo: 'existe', ruta: destino }
    }

    try {
      copiarBase(this.db, destino)
    } catch (error) {
      if (existsSync(destino)) unlinkSync(destino)
      return { tipo: 'error', mensaje: `No se pudieron copiar los datos a ${carpeta}: ${mensajeDe(error)}` }
    }

    const resultado = this.cambiarA(destino)
    return resultado.tipo === 'abierta' ? { tipo: 'movida', ruta: destino } : resultado
  }

  abrirExistente(): ResultadoCambio {
    const ruta = this.rutaExistentePendiente
    if (!ruta) return { tipo: 'error', mensaje: 'No hay ninguna base pendiente de abrir.' }
    this.rutaExistentePendiente = null
    return this.cambiarA(ruta)
  }

  abrir(ruta: string): ResultadoCambio {
    return this.cambiarA(ruta)
  }

  copias(): Copia[] {
    return this.estadoActual.tipo === 'lista' ? listarCopias(this.estadoActual.ruta) : []
  }

  guardarCopiaEn(destino: string): ResultadoCopia {
    if (!this.db || this.estadoActual.tipo !== 'lista') {
      return { tipo: 'error', mensaje: 'No hay ninguna base abierta que copiar.' }
    }
    // VACUUM INTO exige que el destino no exista, así que se escribe aparte y se sustituye al final:
    // si algo falla, el fichero que ella eligiera sobrescribir sigue intacto.
    const temporal = `${destino}.parcial`
    try {
      if (existsSync(temporal)) unlinkSync(temporal)
      copiarBase(this.db, temporal)
      renameSync(temporal, destino)
      return { tipo: 'guardada', ruta: destino }
    } catch (error) {
      if (existsSync(temporal)) unlinkSync(temporal)
      return { tipo: 'error', mensaje: `No se pudo guardar la copia: ${mensajeDe(error)}` }
    }
  }

  restaurarDesde(rutaCopia: string): ResultadoRestauracion {
    if (!this.db || this.estadoActual.tipo !== 'lista') {
      return { tipo: 'error', mensaje: 'No hay ninguna base abierta que restaurar.' }
    }
    const ruta = this.estadoActual.ruta
    if (resolve(rutaCopia) === resolve(ruta)) {
      return { tipo: 'error', mensaje: 'Esa es la base que estás usando ahora, no una copia.' }
    }

    try {
      validarBase(rutaCopia)
    } catch (error) {
      return { tipo: 'error', mensaje: mensajeDe(error) }
    }

    // Antes de sustituir nada, el estado actual queda guardado como una copia más: restaurar por error no pierde datos.
    let copiaPrevia: Copia
    try {
      copiaPrevia = crearCopia(this.db, ruta)
    } catch (error) {
      return { tipo: 'error', mensaje: `No se pudo guardar el estado actual antes de restaurar: ${mensajeDe(error)}` }
    }

    this.cerrar()
    try {
      copyFileSync(rutaCopia, ruta)
      this.sustituir(abrirBaseExistente(ruta, this.migraciones))
    } catch (error) {
      return this.deshacerRestauracion(ruta, copiaPrevia, error)
    }

    rotarCopias(ruta)
    this.estadoActual = { tipo: 'lista', ruta }
    return { tipo: 'restaurada', ruta, copiaPrevia: copiaPrevia.ruta }
  }

  private deshacerRestauracion(ruta: string, copiaPrevia: Copia, error: unknown): ResultadoRestauracion {
    try {
      copyFileSync(copiaPrevia.ruta, ruta)
      this.sustituir(abrirBaseExistente(ruta, this.migraciones))
      this.estadoActual = { tipo: 'lista', ruta }
      return { tipo: 'error', mensaje: `No se pudo restaurar la copia: ${mensajeDe(error)}. Tus datos siguen como estaban.` }
    } catch (fallo) {
      this.estadoActual = { tipo: 'error', ruta, mensaje: mensajeDe(fallo) }
      return {
        tipo: 'error',
        mensaje: `No se pudo restaurar la copia ni recuperar el estado anterior. Tus datos de antes están guardados en ${copiaPrevia.ruta}`
      }
    }
  }

  cerrar(): void {
    this.db?.close()
    this.db = null
  }

  private primerArranque(): EstadoDatos {
    const ruta = this.rutaPorDefecto
    try {
      const db = existsSync(ruta)
        ? abrirBaseExistente(ruta, this.migraciones)
        : crearBase(ruta, this.migraciones)
      guardarConfiguracion(this.rutaConfiguracion, { rutaBaseDatos: ruta })
      this.sustituir(db)
      return (this.estadoActual = { tipo: 'lista', ruta })
    } catch (error) {
      return (this.estadoActual = { tipo: 'error', ruta, mensaje: mensajeDe(error) })
    }
  }

  private conectar(ruta: string): EstadoDatos {
    if (!existsSync(ruta)) {
      this.cerrar()
      return (this.estadoActual = { tipo: 'ausente', ruta })
    }
    try {
      this.sustituir(abrirBaseExistente(ruta, this.migraciones))
      return (this.estadoActual = { tipo: 'lista', ruta, avisoCopia: this.copiaDeArranque(ruta) })
    } catch (error) {
      this.cerrar()
      return (this.estadoActual = { tipo: 'error', ruta, mensaje: mensajeDe(error) })
    }
  }

  // Una copia que falla (USB protegido, disco lleno) no puede impedirle trabajar: se avisa y se sigue.
  private copiaDeArranque(ruta: string): string | undefined {
    try {
      crearCopia(this.conexion(), ruta)
      rotarCopias(ruta)
      return undefined
    } catch (error) {
      return `No se pudo guardar la copia de seguridad de hoy: ${mensajeDe(error)}`
    }
  }

  private cambiarA(ruta: string): ResultadoCambio {
    let nueva: BaseDatos
    try {
      nueva = abrirBaseExistente(ruta, this.migraciones)
    } catch (error) {
      return { tipo: 'error', mensaje: mensajeDe(error) }
    }
    try {
      guardarConfiguracion(this.rutaConfiguracion, { rutaBaseDatos: ruta })
    } catch (error) {
      nueva.close()
      return { tipo: 'error', mensaje: `No se pudo guardar la nueva ubicación: ${mensajeDe(error)}` }
    }
    this.sustituir(nueva)
    this.estadoActual = { tipo: 'lista', ruta }
    return { tipo: 'abierta', ruta }
  }

  private sustituir(db: BaseDatos): void {
    this.db?.close()
    this.db = db
  }
}
