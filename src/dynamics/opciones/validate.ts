import type { ItemActual } from '../../lib/tipos'
import type { Respuesta } from '../tipos'

/** Respuestas de "elegir una opción" ({opcion: i}), compartido por Trivia y Dos verdades. */
export function opcionesDe(item: Pick<ItemActual, 'content'>, campo: 'opciones' | 'afirmaciones'): string[] {
  const v = item.content[campo]
  return Array.isArray(v) ? v.map(String) : []
}

export function validarOpcion(cantidad: number, r: Respuesta | null): string | null {
  const i = r?.opcion
  if (typeof i !== 'number' || !Number.isInteger(i)) return 'Elegí una opción antes de enviar.'
  if (i < 0 || i >= cantidad) return 'Esa opción no existe. Elegí una de las que aparecen.'
  return null
}
