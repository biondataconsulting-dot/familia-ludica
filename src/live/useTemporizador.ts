import { useEffect, useState } from 'react'
import type { Live } from '../lib/tipos'
import { segundosRestantes } from './reloj'

export type Temporizador = { restantes: number; total: number } | null

/**
 * Cuenta regresiva del ítem abierto, con la hora del servidor (corrige el reloj del dispositivo).
 * Con el ítem cerrado o revelado queda congelada donde estaba. Llegar a 0 no cierra nada.
 */
export function useTemporizador(live: Live | null, desfaseMs: number): Temporizador {
  const [ahora, setAhora] = useState(() => Date.now())
  const corriendo = live?.phase === 'item_open' && live.timer_seconds != null

  useEffect(() => {
    if (!corriendo) return
    const id = window.setInterval(() => setAhora(Date.now()), 250)
    return () => window.clearInterval(id)
  }, [corriendo])

  if (!live || live.timer_seconds == null || !['item_open', 'item_closed'].includes(live.phase)) return null
  // Cerrado: se congela en el momento del último cambio (updated_at = cuando se cerró).
  const referencia = live.phase === 'item_open' ? ahora + desfaseMs : Date.parse(live.updated_at ?? live.server_now)
  const restantes = segundosRestantes(live.opened_at, live.timer_seconds, live.extra_seconds, referencia)
  if (restantes == null) return null
  return { restantes, total: live.timer_seconds + live.extra_seconds }
}
