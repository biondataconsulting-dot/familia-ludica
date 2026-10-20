import { describe, expect, it } from 'vitest'
import { CASOS_TEXTO } from './casos-texto'
import { estadoSimilitud, normalizarTexto, similitud, similitudMaxima } from './texto'

describe('normalizarTexto', () => {
  it('minúsculas, sin tildes, sin signos, espacios simples', () => {
    expect(normalizarTexto('  ¡Canción   ANIMAL!  ')).toBe('cancion animal')
  })
  it('saca el artículo inicial (solo al principio)', () => {
    expect(normalizarTexto('Los Redondos')).toBe('redondos')
    expect(normalizarTexto('The Beatles')).toBe('beatles')
    expect(normalizarTexto('Ella usó mi cabeza')).toBe('ella uso mi cabeza')
  })
  it('ñ y diéresis', () => {
    expect(normalizarTexto('Pingüinos en la cama, Año')).toBe('pinguinos en la cama ano')
  })
})

describe('similitud (como pg_trgm)', () => {
  it('idénticos dan 1 y sin nada en común 0', () => {
    expect(similitud('soda stereo', 'soda stereo')).toBe(1)
    expect(similitud('abc', 'xyz')).toBe(0)
  })
  it('es simétrica', () => {
    expect(similitud('soda estereo', 'soda stereo')).toBeCloseTo(similitud('soda stereo', 'soda estereo'), 10)
  })
})

describe('estados', () => {
  it('umbrales 0,75 y 0,45', () => {
    expect(estadoSimilitud(0.75)).toBe('auto_ok')
    expect(estadoSimilitud(0.74)).toBe('dudosa')
    expect(estadoSimilitud(0.45)).toBe('dudosa')
    expect(estadoSimilitud(0.44)).toBe('auto_no')
  })
  for (const c of CASOS_TEXTO) {
    it(c.nombre, () => {
      expect(c.estado).toContain(estadoSimilitud(similitudMaxima(c.respuesta, c.opciones)))
    })
  }
})
