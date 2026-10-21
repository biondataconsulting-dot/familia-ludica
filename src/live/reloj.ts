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

/** Máximo que el reloj espera a que arranque una canción o escena (igual que proyector_media_arranco). */
export const ESPERA_MEDIA_MAX_S = 30

/** true si la canción o escena se abrió hace menos de 30 s (el reloj todavía la espera). */
export function esperaMedia(openedAtIso: string | null, ahoraServidorMs: number): boolean {
  if (!openedAtIso) return false
  const abierto = Date.parse(openedAtIso)
  return !Number.isNaN(abierto) && ahoraServidorMs - abierto < ESPERA_MEDIA_MAX_S * 1000
}
