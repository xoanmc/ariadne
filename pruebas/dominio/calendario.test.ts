import { describe, expect, it } from 'vitest'
import {
  esFecha,
  situarFecha,
  trimestreEnCurso,
  validarCalendario,
  type PeriodoTrimestre
} from '../../src/main/dominio/calendario'

const CURSO: PeriodoTrimestre[] = [
  { numero: 1, fechaInicio: '2025-09-15', fechaFin: '2025-12-19' },
  { numero: 2, fechaInicio: '2026-01-08', fechaFin: '2026-03-27' },
  { numero: 3, fechaInicio: '2026-04-07', fechaFin: '2026-06-19' }
]

describe('esFecha', () => {
  it('acepta una fecha real en el formato del sistema', () => {
    expect(esFecha('2025-09-15')).toBe(true)
  })

  it('rechaza otros formatos y días que no existen', () => {
    expect(esFecha('15/09/2025')).toBe(false)
    expect(esFecha('2025-9-1')).toBe(false)
    expect(esFecha('2025-02-30')).toBe(false)
    expect(esFecha('2025-13-01')).toBe(false)
  })
})

describe('validarCalendario', () => {
  it('da por bueno un curso con sus vacaciones entre trimestres', () => {
    expect(validarCalendario(CURSO)).toEqual([])
  })

  it('exige los tres trimestres', () => {
    expect(validarCalendario(CURSO.slice(0, 2))).toEqual([{ tipo: 'faltan_trimestres', numeros: [3] }])
  })

  it('rechaza que dos trimestres se solapen', () => {
    const solapado = [...CURSO.slice(0, 1), { ...CURSO[1], fechaInicio: '2025-12-10' }, CURSO[2]]
    expect(validarCalendario(solapado)).toEqual([{ tipo: 'solapan', numero: 1, conNumero: 2 }])
  })

  it('rechaza que un trimestre acabe antes de empezar', () => {
    const invertido = [{ ...CURSO[0], fechaInicio: '2025-12-19', fechaFin: '2025-09-15' }, CURSO[1], CURSO[2]]
    expect(validarCalendario(invertido)).toContainEqual({ tipo: 'acaba_antes_de_empezar', numero: 1 })
  })

  it('rechaza una fecha que no es una fecha', () => {
    const malas = [{ ...CURSO[0], fechaFin: '19/12/2025' }, CURSO[1], CURSO[2]]
    expect(validarCalendario(malas)).toContainEqual({ tipo: 'fecha_no_valida', numero: 1 })
  })

  it('un trimestre de un solo día es válido', () => {
    const corto = [{ numero: 1 as const, fechaInicio: '2025-09-15', fechaFin: '2025-09-15' }, CURSO[1], CURSO[2]]
    expect(validarCalendario(corto)).toEqual([])
  })
})

describe('situarFecha', () => {
  it('sitúa una sesión en su trimestre', () => {
    expect(situarFecha(CURSO, '2025-10-07')).toEqual({ tipo: 'dentro', numero: 1 })
    expect(situarFecha(CURSO, '2026-03-27')).toEqual({ tipo: 'dentro', numero: 2 })
  })

  it('incluye los días de inicio y fin', () => {
    expect(situarFecha(CURSO, '2025-09-15')).toEqual({ tipo: 'dentro', numero: 1 })
    expect(situarFecha(CURSO, '2025-12-19')).toEqual({ tipo: 'dentro', numero: 1 })
  })

  it('reconoce las vacaciones entre dos trimestres', () => {
    expect(situarFecha(CURSO, '2025-12-27')).toEqual({ tipo: 'vacaciones', trasNumero: 1, antesDeNumero: 2 })
  })

  it('distingue lo anterior y lo posterior al curso', () => {
    expect(situarFecha(CURSO, '2025-09-01')).toEqual({ tipo: 'antes_del_curso' })
    expect(situarFecha(CURSO, '2026-07-01')).toEqual({ tipo: 'despues_del_curso' })
  })
})

describe('trimestre en curso', () => {
  const t = (id: number, numero: 1 | 2 | 3, fechaInicio: string, fechaFin: string, estado: 'abierto' | 'cerrado' = 'abierto') => ({
    id,
    numero,
    fechaInicio,
    fechaFin,
    estado
  })
  const curso = [t(1, 1, '2026-09-10', '2026-12-22'), t(2, 2, '2027-01-08', '2027-03-26'), t(3, 3, '2027-04-06', '2027-06-23')]

  it('es el abierto que contiene la fecha de hoy', () => {
    expect(trimestreEnCurso(curso, '2026-10-07')?.id).toBe(1)
    expect(trimestreEnCurso(curso, '2027-02-15')?.id).toBe(2)
  })

  it('manda la fecha: aunque el anterior siga sin cerrar, ya está en el siguiente', () => {
    expect(trimestreEnCurso(curso, '2027-01-12')?.id).toBe(2)
  })

  it('en vacaciones o antes de empezar, es el siguiente que va a empezar', () => {
    expect(trimestreEnCurso(curso, '2026-12-28')?.id).toBe(2)
    expect(trimestreEnCurso(curso, '2026-09-01')?.id).toBe(1)
  })

  it('pasado el curso, el último que siga abierto', () => {
    expect(trimestreEnCurso(curso, '2027-07-15')?.id).toBe(3)
  })

  it('no cuenta los cerrados', () => {
    const conPrimeroCerrado = [{ ...curso[0], estado: 'cerrado' as const }, curso[1], curso[2]]
    expect(trimestreEnCurso(conPrimeroCerrado, '2026-12-20')?.id).toBe(2)
  })

  it('si todos están cerrados, no hay trimestre en curso', () => {
    expect(trimestreEnCurso(curso.map((x) => ({ ...x, estado: 'cerrado' as const })), '2027-02-01')).toBeNull()
  })
})
