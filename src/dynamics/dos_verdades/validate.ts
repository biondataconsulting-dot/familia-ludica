import type { ItemActual } from '../../lib/tipos'
import { opcionesDe, validarOpcion } from '../opciones/validate'
import type { Respuesta } from '../tipos'

export const validar = (item: ItemActual, r: Respuesta | null) => validarOpcion(opcionesDe(item, 'afirmaciones').length, r)

export function describir(contenido: Record<string, unknown>, r: Respuesta): string {
  const i = Number(r.opcion)
  return `La ${i + 1}: ${opcionesDe({ content: contenido }, 'afirmaciones')[i] ?? '?'}`
}
