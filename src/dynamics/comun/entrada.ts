/** Entrada de números con teclado propio (coma decimal, como se escribe en Argentina). */

export type OpcionesEntrada = {
  decimales: boolean
  negativos: boolean
  maxDigitos: number
  /** Con el número completo, un dígito nuevo empieza otro (años: de 1990 a escribir 1936 sin borrar). */
  reemplazarAlCompletar?: boolean
  /** Punto de miles al mostrar (no en años: 1986, no 1.986). */
  agruparMiles: boolean
}

export const ENTRADA_NUMERO: OpcionesEntrada = { decimales: true, negativos: true, maxDigitos: 12, agruparMiles: true }
export const ENTRADA_ANIO: OpcionesEntrada = {
  decimales: false,
  negativos: false,
  maxDigitos: 4,
  reemplazarAlCompletar: true,
  agruparMiles: false,
}

const digitos = (texto: string) => texto.replace(/[^0-9]/g, '').length

/** Aplica una tecla ("0"-"9", ",", "±", "⌫") al texto. Nunca deja un texto inválido. */
export function agregarTecla(texto: string, tecla: string, op: OpcionesEntrada): string {
  if (tecla === '⌫') {
    const r = texto.slice(0, -1)
    return r === '-' ? '' : r
  }
  if (tecla === '±') {
    if (!op.negativos) return texto
    return texto.startsWith('-') ? texto.slice(1) : '-' + texto
  }
  if (tecla === ',') {
    if (!op.decimales || texto.includes(',')) return texto
    return texto === '' || texto === '-' ? texto + '0,' : texto + ','
  }
  if (!/^[0-9]$/.test(tecla)) return texto
  if (digitos(texto) >= op.maxDigitos) return op.reemplazarAlCompletar ? tecla : texto
  if (texto === '0') return tecla
  if (texto === '-0') return '-' + tecla
  return texto + tecla
}

/** "12,5" → 12.5. null si está vacío o incompleto ("", "-"). */
export function textoANumero(texto: string): number | null {
  if (!/^-?[0-9]+(,[0-9]*)?$/.test(texto)) return null
  const n = Number(texto.replace(',', '.'))
  return Number.isFinite(n) ? n : null
}

/** 1234.5 → "1234,5" (para volver a editar una respuesta enviada). */
export function numeroATexto(n: number): string {
  return String(n).replace('.', ',')
}

/** Lo que se ve mientras se escribe: "-12345,6" → "−12.345,6". */
export function formatearEntrada(texto: string, agruparMiles = true): string {
  const negativo = texto.startsWith('-')
  const [entero = '', decimal] = texto.replace('-', '').split(',')
  const conPuntos = agruparMiles ? entero.replace(/\B(?=(\d{3})+(?!\d))/g, '.') : entero
  return (negativo ? '−' : '') + conPuntos + (decimal !== undefined ? ',' + decimal : '')
}
