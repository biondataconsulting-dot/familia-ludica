/**
 * Validación de texto de Hitster (spec §7). La que cuenta es la de SQL (private.normalizar_texto,
 * private.similitud_max con pg_trgm); esta copia la replica para documentarla y testearla con los
 * mismos casos (casos-texto.ts).
 */

const ARTICULO_INICIAL = /^(el|la|los|las|the|a|an) /

/** minúsculas, sin tildes, sin signos, espacios simples, sin artículo inicial. */
export function normalizarTexto(texto: string): string {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(ARTICULO_INICIAL, '')
}

/** Trigramas como pg_trgm: cada palabra con dos espacios adelante y uno atrás. */
function trigramas(texto: string): Set<string> {
  const conjunto = new Set<string>()
  for (const palabra of texto.split(/[^a-z0-9]+/).filter(Boolean)) {
    const p = `  ${palabra} `
    for (let i = 0; i + 3 <= p.length; i++) conjunto.add(p.slice(i, i + 3))
  }
  return conjunto
}

/** similarity() de pg_trgm: trigramas en común / trigramas distintos en total. */
export function similitud(a: string, b: string): number {
  const ta = trigramas(a)
  const tb = trigramas(b)
  if (ta.size === 0 || tb.size === 0) return 0
  let comunes = 0
  for (const t of ta) if (tb.has(t)) comunes++
  return comunes / (ta.size + tb.size - comunes)
}

/** Mejor similitud entre la respuesta y la solución o cualquiera de sus variantes (normalizadas). */
export function similitudMaxima(respuesta: string, opciones: string[]): number {
  const r = normalizarTexto(respuesta)
  let mejor = 0
  for (const o of opciones) {
    const n = normalizarTexto(o)
    if (!n) continue
    mejor = Math.max(mejor, r === n ? 1 : similitud(r, n))
  }
  return mejor
}

export type EstadoTexto = 'auto_ok' | 'dudosa' | 'auto_no'

/** ≥ 0,75 auto_ok · 0,45 a 0,75 dudosa · < 0,45 auto_no. */
export function estadoSimilitud(s: number): EstadoTexto {
  return s >= 0.75 ? 'auto_ok' : s >= 0.45 ? 'dudosa' : 'auto_no'
}
