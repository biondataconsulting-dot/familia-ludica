import { useCallback, useEffect, useState } from 'react'
import { ErrorRpc } from '../lib/rpc'
import { extrasAdmin, type ExtrasAdmin } from './rpc'

/** Todo el módulo de una noche para el panel. `senal` cambia → relee (p. ej. el pulso de useLive). */
export function useExtrasAdmin(eventId: string, senal?: unknown) {
  const [datos, setDatos] = useState<ExtrasAdmin | null>(null)
  const [error, setError] = useState<string | null>(null)

  const recargar = useCallback(async () => {
    try {
      setDatos(await extrasAdmin.leer(eventId))
      setError(null)
    } catch (e) {
      setError(e instanceof ErrorRpc ? e.message : 'No se pudieron leer las misiones y desafíos.')
    }
  }, [eventId])

  useEffect(() => {
    void recargar()
  }, [recargar, senal])

  return { datos, error, recargar }
}
