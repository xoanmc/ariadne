import { describe, expect, it } from 'vitest'
import { componerExportacion, fechaConDia, fechaLarga, nombreDeFichero, type DatosExportacion } from '../../src/main/dominio/exportacion'

function datos(extra: Partial<DatosExportacion> = {}): DatosExportacion {
  return {
    alumno: { nombre: 'Lucía', apellidos: 'García Pérez', codigo: 'A-01' },
    curso: '2026/2027',
    nivelEducativo: '3.º de Primaria',
    trimestre: { numero: 1, fechaInicio: '2026-09-10', fechaFin: '2026-12-22', cerrado: true },
    hoy: '2026-12-23',
    objetivos: [
      { enunciado: 'Mejorar la fluidez lectora', valoracion: 'no conseguido', comentario: 'Avanza, pero aún silabea', sesiones: 2, arrastrado: true, estancado: null },
      { enunciado: 'Mantener la atención', valoracion: 'pendiente de desarrollar', comentario: null, sesiones: 0, arrastrado: true, estancado: 2 }
    ],
    sesiones: [
      { fecha: '2026-10-06', falta: false, estadoAlumno: ['Tranquilo'], respuestaActividades: ['Participa', 'Necesita apoyo'], objetivos: ['Mejorar la fluidez lectora'], observaciones: 'Leyó el cuento entero.\nLe costó el final.', saludMedicacion: null },
      { fecha: '2026-10-13', falta: true, estadoAlumno: [], respuestaActividades: [], objetivos: [], observaciones: 'Enfermo', saludMedicacion: null },
      { fecha: '2026-10-20', falta: false, estadoAlumno: [], respuestaActividades: [], objetivos: [], observaciones: null, saludMedicacion: 'Tomó su medicación' }
    ],
    ...extra
  }
}

describe('fechas en palabras', () => {
  it('como ella las escribiría', () => {
    expect(fechaLarga('2026-10-07')).toBe('7 de octubre de 2026')
    expect(fechaConDia('2026-10-07')).toBe('Miércoles, 7 de octubre de 2026')
    expect(fechaConDia('2027-01-01')).toBe('Viernes, 1 de enero de 2027')
  })
})

describe('el fichero del trimestre (T6.1)', () => {
  const texto = componerExportacion(datos())
  const lineas = texto.split('\r\n')

  it('empieza con la cabecera: alumno, curso, trimestre con sus fechas y sesiones', () => {
    expect(lineas.slice(0, 8)).toEqual([
      'REGISTRO DEL 1.ER TRIMESTRE',
      '='.repeat(60),
      '',
      'Alumno:      Lucía García Pérez (A-01)',
      'Curso:       2026/2027, 3.º de Primaria',
      'Trimestre:   1.er trimestre, del 10 de septiembre al 22 de diciembre de 2026',
      'Sesiones:    2 sesiones y 1 falta',
      'Exportado:   23 de diciembre de 2026'
    ])
  })

  it('lleva cada objetivo con su valoración, sus sesiones, su comentario y sus marcas', () => {
    expect(texto).toContain(
      ['* Mejorar la fluidez lectora', '    Valoración: no conseguido', '    Trabajado en 2 sesiones', '    Arrastrado del trimestre anterior', '    Comentario: Avanza, pero aún silabea'].join('\r\n')
    )
    expect(texto).toContain('    No aparece como trabajado en ninguna sesión')
    expect(texto).toContain('    Arrastrado del trimestre anterior; estancado: 2 trimestres seguidos pendiente de desarrollar')
  })

  it('lleva todas las sesiones en orden, con todos sus campos y las faltas', () => {
    expect(texto).toContain(
      [
        'Martes, 6 de octubre de 2026',
        '    Estado: Tranquilo',
        '    Respuesta: Participa, Necesita apoyo',
        '    Objetivos trabajados: Mejorar la fluidez lectora',
        '    Observaciones:',
        '        Leyó el cuento entero.',
        '        Le costó el final.'
      ].join('\r\n')
    )
    expect(texto).toContain('Martes, 13 de octubre de 2026: NO ACUDIÓ\r\n    Motivo: Enfermo')
    expect(texto).toContain('Martes, 20 de octubre de 2026\r\n    Salud o medicación: Tomó su medicación')
    expect(texto.indexOf('6 de octubre')).toBeLessThan(texto.indexOf('13 de octubre'))
  })

  it('usa saltos de línea de Windows y acaba en uno solo', () => {
    expect(texto.replace(/\r\n/g, '')).not.toContain('\n')
    expect(texto.endsWith('\r\n')).toBe(true)
    expect(texto.endsWith('\r\n\r\n')).toBe(false)
  })

  it('si el trimestre sigue abierto, lo advierte', () => {
    const abierto = componerExportacion(datos({ trimestre: { numero: 2, fechaInicio: '2027-01-08', fechaFin: '2027-03-26', cerrado: false } }))
    expect(abierto).toContain('El trimestre sigue abierto: las valoraciones y las sesiones aún pueden cambiar.')
    expect(abierto).toContain('Trimestre:   2.º trimestre, del 8 de enero al 26 de marzo de 2027')
    expect(texto).not.toContain('sigue abierto')
  })

  it('sin objetivos ni sesiones, lo dice en lugar de dejar el apartado vacío', () => {
    const vacio = componerExportacion(datos({ objetivos: [], sesiones: [], nivelEducativo: null }))
    expect(vacio).toContain('Este trimestre no tiene objetivos.')
    expect(vacio).toContain('No hay sesiones registradas en este trimestre.')
    expect(vacio).toContain('Curso:       2026/2027\r\n')
    expect(vacio).toContain('Sesiones:    0 sesiones\r\n')
  })
})

describe('nombre del fichero', () => {
  it('alumno, curso y trimestre, sin caracteres que Windows no admite', () => {
    expect(nombreDeFichero(datos())).toBe('Lucía García Pérez - 2026-2027 - 1.er trimestre.txt')
    expect(nombreDeFichero(datos({ alumno: { nombre: 'Ana / "Anita"', apellidos: 'Ruiz: Vega?', codigo: 'A-02' } }))).toBe(
      'Ana Anita Ruiz Vega - 2026-2027 - 1.er trimestre.txt'
    )
  })
})
