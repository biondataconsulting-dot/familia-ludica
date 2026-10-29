import { describe, expect, it } from 'vitest'
import { codigoCarton, columna, FORMATO, generarCartones, paraReimprimir, rango, type TipoBingo } from './formato'

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

describe('cartones para reimprimir', () => {
  const cartones = [
    { numero: 1, tipo: 'express' as const, filas: [[1, 9, 17], [2, 25, 33], [10, 18, 26]], created_at: '2026-11-01T10:00:00Z' },
    { numero: 2, tipo: 'express' as const, filas: [[3, 11, 19], [4, 27, 35], [12, 20, 28]], created_at: '2026-11-01T10:00:00Z' },
    { numero: 1, tipo: 'full' as const, filas: [[1, 10, 20, 30, 40], [12, 50, 60, 70, 80], [2, 21, 31, 41, 51]], created_at: '2026-11-01T10:00:00Z' },
  ]
  const cancion = (number: number, at: string | null) => ({ number, carton_cambiado_at: at })

  it('solo los cartones que tienen un número cambiado después de imprimir', () => {
    const r = paraReimprimir('express', [cancion(9, '2026-11-02T10:00:00Z'), cancion(3, '2026-10-30T10:00:00Z'), cancion(4, null)], cartones, undefined)
    expect(r).toEqual({ numeros: [9], cartones: [1] })
  })
  it('un número fuera del tipo no cuenta (60 no está en Express)', () => {
    expect(paraReimprimir('express', [cancion(60, '2026-11-02T10:00:00Z')], cartones, undefined).numeros).toEqual([])
    expect(paraReimprimir('full', [cancion(60, '2026-11-02T10:00:00Z')], cartones, undefined)).toEqual({ numeros: [60], cartones: [1] })
  })
  it('«Ya los reimprimí» los deja al día', () => {
    expect(paraReimprimir('express', [cancion(9, '2026-11-02T10:00:00Z')], cartones, '2026-11-03T10:00:00Z').cartones).toEqual([])
  })
  it('sin cartones de ese tipo, nada', () => {
    expect(paraReimprimir('full', [cancion(9, '2026-11-02T10:00:00Z')], cartones.slice(0, 2), undefined)).toEqual({ numeros: [], cartones: [] })
  })
})
