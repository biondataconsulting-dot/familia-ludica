import { useCallback, useEffect, useRef, useState } from 'react'
import { ErrorRpc, getLive } from '../lib/rpc'
import { supabase } from '../lib/supabase'
import type { Live } from '../lib/tipos'
import { calcularDesfase } from './reloj'

/**
 * Completa con valores vacíos lo que falte: si el frontend nuevo llega antes que la migración
 * (o al revés), la pantalla sigue andando en vez de romperse.
 */
function normalizar(l: Live): Live {
  return {
    ...l,
    teams: l.teams ?? [],
    answered: l.answered ?? [],
    ranking: l.ranking ?? [],
    answers_count: l.answers_count ?? 0,
    teams_count: l.teams_count ?? 0,
    extra_seconds: l.extra_seconds ?? 0,
  }
}

const RELECTURA_MS = 5000
/** Varios avisos seguidos (ej.: 15 puntajes al revelar) se juntan en una sola relectura. */
const AGRUPAR_AVISOS_MS = 150

/**
 * Estado en vivo de una noche, para proyector, celulares y panel del conductor.
 * Lee completo al montar, relee al recibir un aviso por Realtime (canal público evento:<CODIGO>,
 * sin datos), cada 5 s, al volver a primer plano y al recuperar la red.
 * También estima el desfase del reloj del dispositivo contra el del servidor.
 */
export function useLive(codigo: string) {
  const [live, setLive] = useState<Live | null>(null)
  const [error, setError] = useState<ErrorRpc | null>(null)
  const [desfaseMs, setDesfaseMs] = useState(0)
  const ultimoPedido = useRef(0)

  const cargar = useCallback(async () => {
    const pedido = ++ultimoPedido.current
    const enviado = Date.now()
    try {
      const datos = normalizar(await getLive(codigo))
      if (pedido !== ultimoPedido.current) return
      setDesfaseMs(calcularDesfase(datos.server_now, enviado, Date.now()))
      setLive(datos)
      setError(null)
    } catch (e) {
      if (pedido === ultimoPedido.current) {
        setError(e instanceof ErrorRpc ? e : new ErrorRpc('Algo salió mal. Probá recargar la página.'))
      }
    }
  }, [codigo])

  useEffect(() => {
    let espera: number | undefined
    const pedirPronto = () => {
      window.clearTimeout(espera)
      espera = window.setTimeout(() => void cargar(), AGRUPAR_AVISOS_MS)
    }

    void cargar()
    const canal = supabase
      .channel(`evento:${codigo.toUpperCase()}`)
      .on('broadcast', { event: 'cambio' }, pedirPronto)
      .subscribe((estado) => {
        // Al (re)conectar el canal puede haberse perdido algún aviso.
        if (estado === 'SUBSCRIBED') pedirPronto()
      })
    const intervalo = window.setInterval(() => void cargar(), RELECTURA_MS)
    const alVolver = () => {
      if (document.visibilityState === 'visible') pedirPronto()
    }
    document.addEventListener('visibilitychange', alVolver)
    window.addEventListener('online', pedirPronto)

    return () => {
      window.clearTimeout(espera)
      window.clearInterval(intervalo)
      document.removeEventListener('visibilitychange', alVolver)
      window.removeEventListener('online', pedirPronto)
      void supabase.removeChannel(canal)
    }
  }, [codigo, cargar])

  return { live, error, desfaseMs, recargar: cargar }
}
