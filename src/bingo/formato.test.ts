import { describe, expect, it } from 'vitest'
import { codigoCarton, columna, FORMATO, generarCartones, rango, type TipoBingo } from './formato'

describe('cartones de bingo', () => {
  for (const tipo of ['express', 'full'] as TipoBingo[]) {
    const f = FORMATO[tipo]
    it(`${f.nombre}: 120 cartones bien armados y todos distintos`, () => {
      const cartones = generarCartones(tipo, 120)
      expect(cartones).toHaveLength(120)
      const claves = new Set<string>()
      const filas = new Set<string>()
      for (const c of cartones) {
        expect(c).toHaveLength(3)
        const todos = c.flat()
        expect(new Set(todos).size).toBe(3 * f.porFila)
        for (const fila of c) {
          expect(fila).toHaveLength(f.porFila)
          expect([...fila].sort((a, b) => a - b)).toEqual(fila)
          expect(new Set(fila.map((n) => columna(tipo, n))).size).toBe(f.porFila)
          expect(filas.has(fila.join(','))).toBe(false)
          filas.add(fila.join(','))
        }
        for (const n of todos) expect(n >= 1 && n <= f.pool).toBe(true)
        for (let col = 0; col < f.columnas; col++) {
          const k = todos.filter((n) => columna(tipo, n) === col).length
          expect(k >= 1 && k <= 3).toBe(true)
        }
        const clave = [...todos].sort((a, b) => a - b).join(',')
        expect(claves.has(clave)).toBe(false)
        claves.add(clave)
      }
    })
  }

  it('columnas: express de a 8, full por decena (80–90 juntos)', () => {
    expect([1, 8, 9, 40].map((n) => columna('express', n))).toEqual([0, 0, 1, 4])
    expect([1, 9, 10, 79, 80, 90].map((n) => columna('full', n))).toEqual([0, 0, 1, 7, 8, 8])
    expect(rango('full', 8)).toEqual([80, 90])
    expect(rango('express', 4)).toEqual([33, 40])
  })

  it('código del cartón', () => {
    expect(codigoCarton('express', 7)).toBe('A-007')
    expect(codigoCarton('full', 36)).toBe('C-036')
  })
})
