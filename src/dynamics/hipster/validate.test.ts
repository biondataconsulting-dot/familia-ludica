import { describe, expect, it } from 'vitest'
import type { ItemActual } from '../../lib/tipos'
import { describir, resultado, validar } from './validate'

const item: ItemActual = { block_item_id: 'x', position: 1, number: 1, type: 'pista_audio', content: {} }

describe('validar (Hipster)', () => {
  it('el año es obligatorio y razonable', () => {
    expect(validar(item, {})).toMatch(/Elegí el año/)
    expect(validar(item, { anio: 1700 })).toMatch(/no es válido/)
    expect(validar(item, { anio: 1986 })).toBeNull()
  })
  it('título y artista son opcionales pero con tope', () => {
    expect(validar(item, { anio: 1986, titulo: 'x'.repeat(101) })).toMatch(/100 caracteres/)
  })
})

describe('describir y resultado (Hipster)', () => {
  it('une lo que mandaron', () => {
    expect(describir({}, { anio: 1986, titulo: 'Persiana americana' })).toBe('1986 · Persiana americana')
  })
  it('detalle del puntaje: año exacto y título aceptado', () => {
    const r = resultado({ diferencia: 0, titulo: 'aceptada', artista: 'auto_no' }, 800)
    expect(r.titulo).toBe('¡Clavaron el año!')
    expect(r.lineas).toEqual(['Año exacto: +600', 'Título ✔ +200', 'Artista ✘ +0'])
  })
  it('año a 2 de diferencia suma 450', () => {
    expect(resultado({ diferencia: 2 }, 450).lineas[0]).toBe('Año: 2 de diferencia → +450')
  })
})
