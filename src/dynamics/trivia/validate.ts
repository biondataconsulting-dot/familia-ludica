import type { ItemActual } from '../../lib/tipos'
import { opcionesDe, validarOpcion } from '../opciones/validate'
import { letraOpcion } from '../solucion'
import type { Respuesta } from '../tipos'

export const validar = (item: ItemActual, r: Respuesta | null) => validarOpcion(opcionesDe(item, 'opciones').length, r)

export function describir(contenido: Record<string, unknown>, r: Respuesta): string {
  const i = Number(r.opcion)
  return `${letraOpcion(i)}. ${opcionesDe({ content: contenido }, 'opciones')[i] ?? '?'}`
}
