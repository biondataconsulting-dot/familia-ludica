import { useCallback, useEffect, useRef, useState } from 'react'
import { ErrorRpc, getLive } from '../lib/rpc'
import { supabase } from '../lib/supabase'
import type { Live } from '../lib/tipos'

const RELECTURA_MS = 5000
/** Varios avisos seguidos (ej.: 15 puntajes al revelar) se juntan en una sola relectura. */
const AGRUPAR_AVISOS_MS = 150

/**
 * Estado en vivo de una noche, para proyector y celulares.
 * Lee completo al montar, relee al recibir un aviso por Realtime (canal público evento:<CODIGO>,
 * sin datos), cada 5 s, al volver a primer plano y al recuperar la red.
 */
export function useLive(codigo: string) {
  const [live, setLive] = useState<Live | null>(null)
  const [error, setError] = useState<ErrorRpc | null>(null)
  const ultimoPedido = useRef(0)

  const cargar = useCallback(async () => {
    const pedido = ++ultimoPedido.current
    try {
      const datos = await getLive(codigo)
      if (pedido === ultimoPedido.current) {
        setLive(datos)
        setError(null)
      }
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

  return { live, error, recargar: cargar }
}
