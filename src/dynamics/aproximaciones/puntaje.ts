/**
 * Fórmula de Aproximaciones (spec §7). La que cuenta es la de SQL (private.score_aproximaciones);
 * esta copia existe para tenerla documentada y testeada con los mismos casos.
 *
 * d = |respuesta − valor|. Las mesas con la distancia mínima: 1.000.
 * El resto: round(800 × (1 − (d − dmin) / (dmax − dmin))); la más lejana, 0.
 * Si todas están a la misma distancia: 1.000 para todas.
 */
export function puntajesAproximacion(respuestas: { id: string; valor: number }[], correcto: number): Map<string, number> {
  const distancias = respuestas.map((r) => ({ id: r.id, d: Math.abs(r.valor - correcto) }))
  const resultado = new Map<string, number>()
  if (distancias.length === 0) return resultado
  const dmin = Math.min(...distancias.map((x) => x.d))
  const dmax = Math.max(...distancias.map((x) => x.d))
  for (const { id, d } of distancias) {
    if (dmax === dmin || d === dmin) resultado.set(id, 1000)
    else resultado.set(id, Math.round(800 * (1 - (d - dmin) / (dmax - dmin))))
  }
  return resultado
}
