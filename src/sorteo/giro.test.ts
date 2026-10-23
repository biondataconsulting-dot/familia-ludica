import { describe, expect, it } from 'vitest'
import { modulo, posicionEn, recorrido } from './giro'

describe('ruleta', () => {
  it('siempre cae en el ganador', () => {
    for (const n of [1, 2, 5, 19, 20, 150, 2000]) {
      for (const destino of [0, Math.floor(n / 2), n - 1]) {
        const d = recorrido(n, destino, `sorteo-${n}-${destino}`)
        expect(modulo(Math.round(posicionEn(9, 9, d)), n)).toBe(destino)
        expect(d).toBeGreaterThanOrEqual(40)
      }
    }
  })

  it('avanza siempre hacia adelante hasta la pasada final, y frena', () => {
    const d = recorrido(30, 7, 'x')
    let antes = 0
    let pasoAnterior = Infinity
    for (let t = 0.5; t <= 8.3; t += 0.5) {
      const p = posicionEn(t, 9, d)
      expect(p).toBeGreaterThan(antes)
      expect(p - antes).toBeLessThanOrEqual(pasoAnterior + 1e-9)
      pasoAnterior = p - antes
      antes = p
    }
    expect(posicionEn(8.3, 9, d)).toBeGreaterThan(d)
    expect(posicionEn(9, 9, d)).toBe(d)
  })

  it('la rueda da al menos las vueltas pedidas', () => {
    for (const n of [3, 12, 30]) {
      const d = recorrido(n, 2, 'r', 3)
      expect(d).toBeGreaterThanOrEqual(3 * n)
      expect(modulo(d, n)).toBe(2)
    }
  })

  it('módulo positivo', () => {
    expect(modulo(-1, 5)).toBe(4)
    expect(modulo(12, 5)).toBe(2)
  })
})
