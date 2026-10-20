import { describe, expect, it } from 'vitest'
import { agregarTecla, ENTRADA_ANIO, ENTRADA_NUMERO, formatearEntrada, numeroATexto, textoANumero } from './entrada'

const escribir = (teclas: string, op = ENTRADA_NUMERO) => [...teclas].reduce((t, k) => agregarTecla(t, k, op), '')

describe('agregarTecla', () => {
  it('escribe dígitos y una sola coma', () => {
    expect(escribir('12,5,3')).toBe('12,53')
  })
  it('coma al principio agrega el 0', () => {
    expect(escribir(',5')).toBe('0,5')
  })
  it('no deja ceros a la izquierda', () => {
    expect(escribir('007')).toBe('7')
  })
  it('± cambia el signo; borrar el último dígito de un negativo no deja el "-" suelto', () => {
    expect(escribir('5±')).toBe('-5')
    expect(agregarTecla('-5', '⌫', ENTRADA_NUMERO)).toBe('')
  })
  it('respeta el máximo de dígitos', () => {
    expect(escribir('1234567890123')).toBe('123456789012')
  })
  it('año: sin coma ni signo; con 4 dígitos, el siguiente empieza un año nuevo', () => {
    expect(escribir('19,86±', ENTRADA_ANIO)).toBe('1986')
    expect(escribir('19861936', ENTRADA_ANIO)).toBe('1936')
  })
})

describe('textoANumero', () => {
  it('convierte con coma decimal', () => {
    expect(textoANumero('12,5')).toBe(12.5)
    expect(textoANumero('-3')).toBe(-3)
    expect(textoANumero('7,')).toBe(7)
  })
  it('null si está vacío o incompleto', () => {
    expect(textoANumero('')).toBeNull()
    expect(textoANumero('-')).toBeNull()
    expect(textoANumero('abc')).toBeNull()
  })
})

describe('formato', () => {
  it('separa miles con punto y usa signo menos tipográfico', () => {
    expect(formatearEntrada('-12345,6')).toBe('−12.345,6')
    expect(formatearEntrada('6961')).toBe('6.961')
    expect(formatearEntrada('0,')).toBe('0,')
  })
  it('los años van sin punto de miles', () => {
    expect(formatearEntrada('1986', ENTRADA_ANIO.agruparMiles)).toBe('1986')
  })
  it('numeroATexto vuelve a la forma editable', () => {
    expect(numeroATexto(1234.5)).toBe('1234,5')
  })
})
