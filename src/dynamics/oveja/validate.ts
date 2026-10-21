import type { ItemActual, Revelado } from '../../lib/tipos'
import type { Respuesta } from '../tipos'

const MAX = 60

export function validar(_item: ItemActual, r: Respuesta | null): string | null {
  const v = typeof r?.texto === 'string' ? r.texto.trim() : ''
  if (!v) return 'Escribí tu respuesta antes de enviar.'
  if (v.length > MAX) return `La respuesta puede tener hasta ${MAX} caracteres.`
  return null
}

export function describir(_contenido: Record<string, unknown>, r: Respuesta): string {
  return typeof r.texto === 'string' ? r.texto : ''
}

/** Detalle por mesa que arma la base (private.score_oveja). */
export type DetalleOveja = {
  texto?: string
  grupo?: string
  etiqueta?: string
  tam?: number
  mayoria?: boolean
  oveja_negra?: boolean
  unanimidad?: boolean
}

export type Grupo = { grupo: string; etiqueta: string; tam: number; mayoria: boolean; mesas: string[] }

/** Con mayúscula inicial ("asado" → "Asado"). */
export const conMayuscula = (t: string) => (t ? t.charAt(0).toUpperCase() + t.slice(1) : t)

/** Grupos del revelado, del más numeroso al menos; además, la oveja negra y si hubo unanimidad o empate. */
export function agrupar(puntos: Revelado['points']) {
  const porGrupo = new Map<string, Grupo>()
  let ovejaNegra: string | null = null
  let unanimidad = false
  for (const p of puntos) {
    const d = (p.detail ?? {}) as DetalleOveja
    const clave = d.grupo ?? d.texto ?? p.team_id
    const g = porGrupo.get(clave) ?? { grupo: clave, etiqueta: conMayuscula(d.etiqueta ?? d.texto ?? ''), tam: 0, mayoria: Boolean(d.mayoria), mesas: [] }
    g.tam += 1
    g.mesas.push(p.name)
    porGrupo.set(clave, g)
    if (d.oveja_negra) ovejaNegra = p.name
    if (d.unanimidad) unanimidad = true
  }
  const grupos = [...porGrupo.values()].sort((a, b) => b.tam - a.tam || a.etiqueta.localeCompare(b.etiqueta))
  const empate = !unanimidad && grupos.length > 1 && !grupos.some((g) => g.mayoria)
  return { grupos, ovejaNegra, unanimidad, empate }
}

/** Lo que ve la mesa al revelar. */
export function resultado(detail: Record<string, unknown>, puntos: number): { titulo: string; lineas: string[] } {
  const d = detail as DetalleOveja
  const tam = Number(d.tam ?? 1)
  const linea = `Escribieron: ${d.texto ?? ''}${tam > 1 ? ` (igual que ${tam - 1} ${tam - 1 === 1 ? 'mesa más' : 'mesas más'})` : ''}`
  if (puntos > 0) return { titulo: '¡Pensaron como el rebaño! 🐑', lineas: [linea] }
  if (d.oveja_negra) return { titulo: '¡Fueron la oveja negra! 🐑', lineas: [linea, 'No resta: es solo para reírse.'] }
  if (d.unanimidad) return { titulo: 'Todas pensaron igual: nadie suma', lineas: [linea] }
  return { titulo: 'Esta vez no', lineas: [linea] }
}
