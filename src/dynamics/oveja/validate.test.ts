import { describe, expect, it } from 'vitest'
import { agrupar, resultado } from './validate'

const p = (name: string, d: Record<string, unknown>, points = 0) => ({ team_id: name, name, points, detail: d })

describe('agrupar (Oveja Oveja)', () => {
  it('ordena por tamaño, marca el rebaño y pone mayúscula a la etiqueta', () => {
    const r = agrupar([
      p('A', { grupo: 'asado', etiqueta: 'asado', tam: 2, mayoria: true }, 1000),
      p('B', { grupo: 'asado', etiqueta: 'asado', tam: 2, mayoria: true }, 1000),
      p('C', { grupo: 'pizza', etiqueta: 'Pizza', tam: 1 }),
    ])
    expect(r.grupos.map((g) => [g.etiqueta, g.tam, g.mayoria])).toEqual([
      ['Asado', 2, true],
      ['Pizza', 1, false],
    ])
    expect(r.empate).toBe(false)
  })
  it('detecta empate arriba (nadie es mayoría)', () => {
    const r = agrupar([p('A', { grupo: 'a', tam: 1 }), p('B', { grupo: 'b', tam: 1 })])
    expect(r.empate).toBe(true)
  })
  it('unanimidad no es empate', () => {
    const r = agrupar([p('A', { grupo: 'a', tam: 2, unanimidad: true }), p('B', { grupo: 'a', tam: 2, unanimidad: true })])
    expect(r.unanimidad).toBe(true)
    expect(r.empate).toBe(false)
  })
  it('encuentra la oveja negra', () => {
    const r = agrupar([p('A', { grupo: 'a', tam: 2, mayoria: true }, 1000), p('B', { grupo: 'a', tam: 2, mayoria: true }, 1000), p('C', { grupo: 'b', tam: 1, oveja_negra: true })])
    expect(r.ovejaNegra).toBe('C')
  })
})

describe('resultado (Oveja Oveja)', () => {
  it('mayoría', () => expect(resultado({ texto: 'Asado', tam: 3, mayoria: true }, 1000).titulo).toContain('rebaño'))
  it('oveja negra: no resta', () => expect(resultado({ texto: 'Sushi', tam: 1, oveja_negra: true }, 0).lineas).toContain('No resta: es solo para reírse.'))
})
