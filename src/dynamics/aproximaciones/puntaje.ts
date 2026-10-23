/**
 * Fórmula de Aproximaciones. La que cuenta es la de SQL (private.score_aproximaciones); esta copia existe
 * para tenerla documentada y testeada con los mismos casos (casos.ts).
 *
 * Por puesto, como un podio, según la distancia al valor correcto (d = |respuesta − valor|):
 * 1° 1.000 · 2° 700 · 3° 500 · 4° 300 · 5° y siguientes 100.
 * Las empatadas comparten puesto y el siguiente se saltea (1°, 2°, 2°, 4°).
 */
export const PUNTOS_POR_PUESTO = [1000, 700, 500, 300] as const
export const PUNTOS_RESTO = 100

export function puntosDelPuesto(puesto: number): number {
  return PUNTOS_POR_PUESTO[puesto - 1] ?? PUNTOS_RESTO
}

export function puntajesAproximacion(respuestas: { id: string; valor: number }[], correcto: number): Map<string, number> {
  const distancias = respuestas.map((r) => ({ id: r.id, d: Math.abs(r.valor - correcto) }))
  const resultado = new Map<string, number>()
  for (const { id, d } of distancias) {
    const puesto = 1 + distancias.filter((o) => o.d < d).length
    resultado.set(id, puntosDelPuesto(puesto))
  }
  return resultado
}
