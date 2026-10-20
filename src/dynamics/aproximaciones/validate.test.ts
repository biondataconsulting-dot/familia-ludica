import { describe, expect, it } from 'vitest'
import type { ItemActual } from '../../lib/tipos'
import { describir, validar } from './validate'

const item = (content: Record<string, unknown>): ItemActual => ({ block_item_id: 'x', position: 1, number: 1, type: 'pregunta_numerica', content })

describe('validar (Aproximaciones)', () => {
  it('pide un número', () => {
    expect(validar(item({}), {})).toMatch(/Escribí un número/)
    expect(validar(item({}), null)).toMatch(/Escribí un número/)
  })
  it('acepta decimales y negativos en preguntas numéricas', () => {
    expect(validar(item({ formato: 'numero' }), { valor: -12.5 })).toBeNull()
  })
  it('en años exige un entero razonable', () => {
    expect(validar(item({ formato: 'anio' }), { valor: 1986 })).toBeNull()
    expect(validar(item({ formato: 'anio' }), { valor: 1986.5 })).toMatch(/año válido/)
  })
})

describe('describir (Aproximaciones)', () => {
  it('número con unidad o año pelado', () => {
    expect(describir({ unidad: 'metros' }, { valor: 6961 })).toBe('6.961 metros')
    expect(describir({ formato: 'anio' }, { valor: 1936 })).toBe('1936')
  })
})
