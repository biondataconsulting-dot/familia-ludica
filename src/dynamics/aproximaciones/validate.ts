import type { ItemActual } from '../../lib/tipos'
import { formatearNumero } from '../solucion'
import type { Respuesta } from '../tipos'

export function validar(item: ItemActual, r: Respuesta | null): string | null {
  const v = r?.valor
  if (typeof v !== 'number' || !Number.isFinite(v)) return 'Escribí un número antes de enviar.'
  if (Math.abs(v) > 1e12) return 'Ese número es demasiado grande. Revisalo y probá de nuevo.'
  if (item.content.formato === 'anio' && (!Number.isInteger(v) || v < 1 || v > 9999)) return 'Escribí un año válido (por ejemplo, 1986).'
  return null
}

export function describir(contenido: Record<string, unknown>, r: Respuesta): string {
  const v = Number(r.valor)
  if (contenido.formato === 'anio') return String(v)
  const unidad = typeof contenido.unidad === 'string' && contenido.unidad ? ` ${contenido.unidad}` : ''
  return formatearNumero(v) + unidad
}
