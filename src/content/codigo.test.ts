import { describe, expect, it } from 'vitest'
import { sugerirCodigo } from './codigo'

describe('sugerirCodigo', () => {
  it('saca las palabras de relleno y suma el número de edición', () => {
    expect(sugerirCodigo('Noche de Juegos en Naudir — 3ra Edición')).toBe('NAUDIR3')
  })
  it('noche temática', () => {
    expect(sugerirCodigo('Noche de Halloween')).toBe('HALLOWEEN')
  })
  it('sin tildes y con tope de 12', () => {
    expect(sugerirCodigo('Fiesta Lúdica Primaveral en Escobar')).toBe('FIESTALUDICA')
  })
  it('siempre cumple el formato de la base (3 a 12 letras o números)', () => {
    for (const n of ['', 'De la noche', '¡¡!!', 'Noche 2', 'Año Nuevo 2027']) {
      expect(sugerirCodigo(n)).toMatch(/^[A-Z0-9]{3,12}$/)
    }
  })
})
