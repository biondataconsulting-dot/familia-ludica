import { useEffect } from 'react'
import { cerrarSiVencio } from '../lib/rpc'
import type { Live } from '../lib/tipos'
import type { Temporizador } from './useTemporizador'

const REINTENTO_MS = 2000

/**
 * Cierre automático: con el ítem abierto y el reloj en 0, pide a la base que cierre (proyector y panel;
 * con que uno esté abierto alcanza). La base decide con su hora; si todavía no venció o falla la red,
 * reintenta cada 2 s mientras siga abierto.
 */
export function useCierreAutomatico(codigo: string, live: Live | null, temporizador: Temporizador) {
  const vencido = live?.phase === 'item_open' && temporizador != null && temporizador.restantes <= 0
  const item = live?.item?.block_item_id

  useEffect(() => {
    if (!vencido) return
    const pedir = () => void cerrarSiVencio(codigo).catch(() => undefined)
    pedir()
    const id = window.setInterval(pedir, REINTENTO_MS)
    return () => window.clearInterval(id)
  }, [vencido, codigo, item])
}
