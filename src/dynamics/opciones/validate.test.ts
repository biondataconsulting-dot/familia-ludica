import { describe, expect, it } from 'vitest'
import { opcionesDe, validarOpcion } from './validate'

describe('validarOpcion', () => {
  it('acepta un índice entero dentro del rango', () => {
    expect(validarOpcion(4, { opcion: 0 })).toBeNull()
    expect(validarOpcion(4, { opcion: 3 })).toBeNull()
  })
  it('pide elegir si no hay opción', () => {
    expect(validarOpcion(4, null)).toMatch(/Elegí una opción/)
    expect(validarOpcion(4, {})).toMatch(/Elegí una opción/)
    expect(validarOpcion(4, { opcion: '1' })).toMatch(/Elegí una opción/)
    expect(validarOpcion(4, { opcion: 1.5 })).toMatch(/Elegí una opción/)
  })
  it('rechaza índices fuera de rango', () => {
    expect(validarOpcion(3, { opcion: 3 })).toMatch(/no existe/)
    expect(validarOpcion(3, { opcion: -1 })).toMatch(/no existe/)
  })
})

describe('opcionesDe', () => {
  it('lee la lista del contenido o devuelve vacío', () => {
    expect(opcionesDe({ content: { opciones: ['a', 'b'] } }, 'opciones')).toEqual(['a', 'b'])
    expect(opcionesDe({ content: {} }, 'afirmaciones')).toEqual([])
  })
})
