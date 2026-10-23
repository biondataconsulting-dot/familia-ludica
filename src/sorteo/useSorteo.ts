import { useCallback, useEffect, useState } from 'react'
import { ErrorRpc } from '../lib/rpc'
import type { Live } from '../lib/tipos'
import { getSorteo, sorteoAdmin, type SorteoAdmin, type SorteoPublico } from './rpc'

/** true mientras el bloque en pantalla es el del sorteo. */
export const enSorteo = (live: Live | null) => live?.block?.dynamic === 'sorteo'

/**
 * Sorteo para proyector y celulares: solo se consulta durante el bloque del sorteo. Se relee cada vez
 * que useLive relee (aviso en tiempo real o cada 5 s). Si una lectura falla, queda lo último leído.
 */
export function useSorteo(codigo: string, live: Live | null): SorteoPublico | null {
  const activo = enSorteo(live)
  const [sorteo, setSorteo] = useState<SorteoPublico | null>(null)
  const pulso = live?.server_now

  useEffect(() => {
    if (!activo) {
      setSorteo(null)
      return
    }
    let vigente = true
    getSorteo(codigo)
      .then((x) => vigente && setSorteo(x))
      .catch(() => undefined)
    return () => {
      vigente = false
    }
  }, [activo, codigo, pulso])

  return activo ? sorteo : null
}

/** Todo el sorteo de una noche para el panel. `senal` cambia → relee (p. ej. el pulso de useLive). */
export function useSorteoAdmin(eventId: string, senal?: unknown) {
  const [datos, setDatos] = useState<SorteoAdmin | null>(null)
  const [error, setError] = useState<string | null>(null)

  const recargar = useCallback(async () => {
    try {
      setDatos(await sorteoAdmin.leer(eventId))
      setError(null)
    } catch (e) {
      setError(e instanceof ErrorRpc ? e.message : 'No se pudo leer el sorteo.')
    }
  }, [eventId])

  useEffect(() => {
    void recargar()
  }, [recargar, senal])

  return { datos, error, recargar }
}
