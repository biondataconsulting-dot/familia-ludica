import { describe, expect, it } from 'vitest'
import { leerParticipantes } from './pegar'

describe('leerParticipantes', () => {
  it('lee lo pegado de Excel (tabulación), con títulos y filas vacías', () => {
    expect(leerParticipantes('Nombre\tLote\nAna Pérez\t12\n\nBeto\t\n')).toEqual([
      { nombre: 'Ana Pérez', dato: '12' },
      { nombre: 'Beto', dato: '' },
    ])
  })

  it('lee CSV con punto y coma y comillas', () => {
    expect(leerParticipantes(String.fromCharCode(0xfeff) + '"Caro Díaz";"DNI 482"\r\nDani;7')).toEqual([
      { nombre: 'Caro Díaz', dato: 'DNI 482' },
      { nombre: 'Dani', dato: '7' },
    ])
  })

  it('una columna sola: solo nombres', () => {
    expect(leerParticipantes('Eva\nFede')).toEqual([
      { nombre: 'Eva', dato: '' },
      { nombre: 'Fede', dato: '' },
    ])
  })
})
