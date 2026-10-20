import { describe, expect, it } from 'vitest'
import { consigna, describirSolucion } from './solucion'

describe('describirSolucion', () => {
  it('trivia: letra y texto de la opción correcta', () => {
    expect(describirSolucion('pregunta_opciones', { opciones: ['28', '32'] }, { correcta: 1 })).toBe('B. 32')
  })
  it('dos verdades: número y texto de la mentira', () => {
    expect(describirSolucion('trio_verdad_mentira', { afirmaciones: ['a', 'b', 'c'] }, { mentira: 2 })).toBe(
      'La mentira es la 3: c',
    )
  })
  it('aproximaciones: número con formato local y unidad', () => {
    expect(describirSolucion('pregunta_numerica', { unidad: 'km' }, { valor: 1234.5 })).toBe('1.234,5 km')
    expect(describirSolucion('pregunta_numerica', { formato: 'anio' }, { valor: 1986 })).toBe('1986')
  })
  it('hipster: año, título y artista', () => {
    expect(
      describirSolucion('pista_audio', {}, { anio: 1986, titulo: 'Persiana americana', artista: 'Soda Stereo' }),
    ).toBe('1986 · Persiana americana · Soda Stereo')
  })
})

describe('consigna', () => {
  it('usa el texto o una consigna fija según el tipo', () => {
    expect(consigna('pregunta_opciones', { texto: '¿Cuántas?' })).toBe('¿Cuántas?')
    expect(consigna('pista_audio', {})).toBe('¿De qué año es esta canción?')
  })
})
