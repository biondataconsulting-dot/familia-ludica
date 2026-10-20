import { describe, expect, it } from 'vitest'
import { CASOS_APROXIMACION } from './casos'
import { puntajesAproximacion } from './puntaje'

describe('puntajesAproximacion', () => {
  for (const caso of CASOS_APROXIMACION) {
    it(caso.nombre, () => {
      expect(Object.fromEntries(puntajesAproximacion(caso.respuestas, caso.correcto))).toEqual(caso.esperado)
    })
  }

  it('sin respuestas no reparte nada', () => {
    expect(puntajesAproximacion([], 10).size).toBe(0)
  })
})
