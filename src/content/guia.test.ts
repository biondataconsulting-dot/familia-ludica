import { describe, expect, it } from 'vitest'
import guia from '../../docs/GUIA_CATALOGO.md?raw'
import { leerImportacion } from './importar'
import { NOMBRE_TIPO, TIPOS } from './validarItem'

/**
 * La guía para generar el catálogo con IA (docs/GUIA_CATALOGO.md) tiene que estar al día con la app:
 * explica todos los tipos de ítem y sus ejemplos JSON se importan sin errores. Tipo nuevo → este test falla
 * hasta que se agregue a la guía.
 */
const bloquesJson = [...guia.matchAll(/```json\r?\n([\s\S]*?)```/g)].map((m) => m[1] ?? '')

describe('guía del catálogo', () => {
  it.each(TIPOS)('explica el tipo %s, con el mismo nombre que el catálogo', (tipo) => {
    const juego = NOMBRE_TIPO[tipo].replace(/ \(.*\)$/, '')
    expect(guia).toContain(`#### ${juego} — tipo: \`${tipo}\``)
  })

  it('tiene el prompt para copiar', () => {
    expect(guia).toMatch(/```text\r?\n[\s\S]*Pedido:[\s\S]*```/)
  })

  it('tiene un ejemplo JSON por tipo', () => {
    const tipos = new Set(bloquesJson.flatMap((b) => (JSON.parse(b) as { tipo: string }[]).map((i) => i.tipo)))
    expect([...tipos].sort()).toEqual([...TIPOS].sort())
  })

  it.each(bloquesJson.map((b, i) => [i + 1, b] as const))('el ejemplo %i se importa sin errores', (_n, bloque) => {
    const { filas, error } = leerImportacion(bloque)
    expect(error).toBeNull()
    expect(filas.length).toBeGreaterThan(0)
    for (const f of filas) {
      expect(f.error).toBeNull()
      expect(['facil', 'media', 'dificil']).toContain(f.item?.dificultad)
      expect(f.item?.etiquetas.length).toBeGreaterThan(0)
    }
  })
})
