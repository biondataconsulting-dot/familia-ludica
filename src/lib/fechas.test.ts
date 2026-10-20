import { describe, expect, it } from 'vitest'
import { formatearFecha } from './fechas'

describe('formatearFecha', () => {
  it('muestra día de la semana, número y mes en español', () => {
    expect(formatearFecha('2026-10-23')).toBe('viernes 23 de octubre')
  })
  it('no corre la fecha por la zona horaria', () => {
    expect(formatearFecha('2026-01-01')).toBe('jueves 1 de enero')
  })
  it('vacío si no hay fecha o es inválida', () => {
    expect(formatearFecha(null)).toBe('')
    expect(formatearFecha('23/10/2026')).toBe('')
  })
})
