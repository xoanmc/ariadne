import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const DOMINIO = fileURLToPath(new URL('../../src/main/dominio', import.meta.url))

function ficherosDelDominio(): string[] {
  return readdirSync(DOMINIO).filter((n) => n.endsWith('.ts'))
}

function importacionesDe(fichero: string): string[] {
  const codigo = readFileSync(join(DOMINIO, fichero), 'utf8')
  const patrones = [/\bfrom\s+['"]([^'"]+)['"]/g, /\bimport\s*\(\s*['"]([^'"]+)['"]/g, /\brequire\s*\(\s*['"]([^'"]+)['"]/g]
  return patrones.flatMap((patron) => [...codigo.matchAll(patron)].map((m) => m[1]))
}

describe('aislamiento de la capa de dominio', () => {
  it('hay dominio que probar', () => {
    expect(ficherosDelDominio().length).toBeGreaterThan(0)
  })

  // Si esta prueba falla, el dominio ha dejado de poder probarse solo: la tarea que lo rompió no está hecha (P7).
  it('no depende de Electron, de SQLite ni de ninguna otra capa', () => {
    const intrusas = ficherosDelDominio().flatMap((fichero) =>
      importacionesDe(fichero)
        .filter((ruta) => !ruta.startsWith('./'))
        .map((ruta) => `${fichero} → ${ruta}`)
    )

    expect(intrusas).toEqual([])
  })
})
