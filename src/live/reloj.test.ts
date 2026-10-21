import { describe, expect, it } from 'vitest'
import { calcularDesfase, esperaMedia, segundosRestantes } from './reloj'

describe('calcularDesfase', () => {
  it('usa el punto medio del pedido', () => {
    // El pedido salió a los 1.000 ms y volvió a los 1.200: el servidor respondió ~1.100 (hora local).
    expect(calcularDesfase(new Date(6_100).toISOString(), 1_000, 1_200)).toBe(5_000)
  })
  it('detecta un dispositivo adelantado', () => {
    expect(calcularDesfase(new Date(1_000).toISOString(), 4_000, 4_000)).toBe(-3_000)
  })
  it('0 si la fecha no se puede leer', () => {
    expect(calcularDesfase('cualquier cosa', 0, 0)).toBe(0)
  })
})

describe('segundosRestantes', () => {
  const abierto = '2026-10-23T22:00:00.000Z'
  const t = (s: number) => Date.parse(abierto) + s * 1000

  it('descuenta desde la apertura', () => {
    expect(segundosRestantes(abierto, 30, 0, t(10))).toBe(20)
  })
  it('suma el tiempo extra', () => {
    expect(segundosRestantes(abierto, 30, 15, t(40))).toBe(5)
  })
  it('se vuelve negativo cuando el tiempo se pasó (no cierra solo)', () => {
    expect(segundosRestantes(abierto, 30, 0, t(32))).toBe(-2)
  })
  it('null sin temporizador o sin apertura', () => {
    expect(segundosRestantes(abierto, null, 0, t(1))).toBeNull()
    expect(segundosRestantes(null, 30, 0, t(1))).toBeNull()
  })
})

describe('esperaMedia', () => {
  const abierto = '2026-10-23T22:00:00.000Z'
  const t = Date.parse(abierto)
  it('espera durante los primeros 30 s', () => {
    expect(esperaMedia(abierto, t + 5_000)).toBe(true)
    expect(esperaMedia(abierto, t + 29_900)).toBe(true)
  })
  it('a los 30 s deja de esperar (el reloj corre desde que se abrió)', () => {
    expect(esperaMedia(abierto, t + 30_000)).toBe(false)
  })
  it('sin hora de apertura no espera', () => {
    expect(esperaMedia(null, t)).toBe(false)
    expect(esperaMedia('basura', t)).toBe(false)
  })
})
