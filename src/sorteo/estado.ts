import type { SorteoPublico } from './rpc'

/** Margen después del último ganador antes de mostrar la lista completa de ganadores. */
const LISTA_FINAL_S = 15

export type Momento =
  | { tipo: 'espera'; premio: SorteoPublico['premios'][number] | null; numero: number }
  | { tipo: 'girando' | 'ganador' | 'ausente'; premio: SorteoPublico['premios'][number] | null; numero: number; t: number }
  | { tipo: 'fin' }

/**
 * Qué mostrar del sorteo a `t` segundos (hora del servidor) del último que salió.
 * espera → nadie salió todavía para el premio que viene · girando → la ruleta está girando ·
 * ganador → se ve quién ganó (hasta que se sortee el siguiente) · ausente → no estaba, se vuelve a
 * sortear el mismo premio · fin → todos los premios tienen ganador (un rato después del último).
 */
export function momentoDe(s: SorteoPublico, ahoraServidorMs: number): Momento {
  const u = s.ultimo
  const t = u ? (ahoraServidorMs - Date.parse(u.at)) / 1000 : 0
  const pendiente = s.premios.findIndex((p) => !p.ganador)
  if (u) {
    const i = s.premios.findIndex((p) => p.id === u.premio_id)
    const premio = s.premios[i] ?? null
    if (t < s.giro_segundos) return { tipo: 'girando', premio, numero: i + 1, t: Math.max(0, t) }
    if (u.estado === 'ausente') return { tipo: 'ausente', premio, numero: i + 1, t }
    if (pendiente < 0 && s.premios.length > 0 && t >= s.giro_segundos + LISTA_FINAL_S) return { tipo: 'fin' }
    return { tipo: 'ganador', premio, numero: i + 1, t }
  }
  return { tipo: 'espera', premio: s.premios[pendiente] ?? null, numero: pendiente + 1 }
}

/** Desfase entre la hora del servidor y la del dispositivo, medido al recibir la lectura. */
export const desfaseDe = (s: SorteoPublico) => Date.parse(s.server_now) - Date.now()
