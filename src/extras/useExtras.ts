import { useEffect, useState } from 'react'
import type { Live } from '../lib/tipos'
import { getExtras, type ExtrasPublicos } from './rpc'

/** true si la noche tiene prendido el módulo de misiones o el de desafíos. */
export function extrasActivos(live: Live | null): boolean {
  const s = live?.event.settings
  return Boolean(s?.misiones || s?.desafios)
}

/**
 * Misiones abiertas y desafío en curso para proyector y celulares. Con el módulo apagado no consulta
 * nada. Se relee cada vez que useLive relee (aviso en tiempo real o cada 5 s): no abre otro canal.
 * Si una lectura falla, queda lo último que se leyó.
 */
export function useExtras(codigo: string, live: Live | null, token: string | null = null): ExtrasPublicos | null {
  const activo = extrasActivos(live)
  const [extras, setExtras] = useState<ExtrasPublicos | null>(null)
  const pulso = live?.server_now

  useEffect(() => {
    if (!activo) {
      setExtras(null)
      return
    }
    let vigente = true
    getExtras(codigo, token)
      .then((x) => vigente && setExtras(x))
      .catch(() => undefined)
    return () => {
      vigente = false
    }
  }, [activo, codigo, token, pulso])

  return activo ? extras : null
}
