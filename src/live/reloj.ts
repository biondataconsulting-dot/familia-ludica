/**
 * Desfase entre el reloj del servidor y el del dispositivo, estimado con el punto medio del pedido
 * (el servidor respondió más o menos a mitad de camino). Positivo = el dispositivo atrasa.
 */
export function calcularDesfase(serverNowIso: string, enviadoMs: number, recibidoMs: number): number {
  const servidor = Date.parse(serverNowIso)
  if (Number.isNaN(servidor)) return 0
  return servidor - (enviadoMs + recibidoMs) / 2
}

/**
 * Segundos que faltan del temporizador (puede ser negativo: el tiempo se pasó).
 * null si el ítem no tiene temporizador o no está abierto.
 */
export function segundosRestantes(
  openedAtIso: string | null,
  timerSeconds: number | null,
  extraSeconds: number,
  ahoraServidorMs: number,
): number | null {
  if (!openedAtIso || timerSeconds == null) return null
  const abierto = Date.parse(openedAtIso)
  if (Number.isNaN(abierto)) return null
  const fin = abierto + (timerSeconds + extraSeconds) * 1000
  return (fin - ahoraServidorMs) / 1000
}
