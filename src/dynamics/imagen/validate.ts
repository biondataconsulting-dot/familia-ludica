import type { ItemActual } from '../../lib/tipos'
import type { Respuesta } from '../tipos'

const MAX = 100

export function validar(_item: ItemActual, r: Respuesta | null): string | null {
  const v = typeof r?.respuesta === 'string' ? r.respuesta.trim() : ''
  if (!v) return 'Escribí tu respuesta antes de enviar.'
  if (v.length > MAX) return `La respuesta puede tener hasta ${MAX} caracteres.`
  return null
}

export function describir(_contenido: Record<string, unknown>, r: Respuesta): string {
  return typeof r.respuesta === 'string' ? r.respuesta : ''
}

/** Lo que ve la mesa al revelar. */
export function resultado(detail: Record<string, unknown>, puntos: number): { titulo: string; lineas: string[] } {
  const escribieron = typeof detail.texto === 'string' ? `Escribieron: ${detail.texto}` : ''
  return { titulo: puntos > 0 ? '¡Acertaron!' : 'Esta vez no', lineas: escribieron ? [escribieron] : [] }
}
