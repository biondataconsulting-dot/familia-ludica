import { useEffect, useState } from 'react'

const CADA_MS = 60_000

/**
 * true si se publicó una versión nueva de la app después de cargar esta pantalla (compara la versión que
 * trae el código con /version.json). Así una pantalla que quedó abierta desde antes avisa que hay que recargarla.
 */
export function useVersionNueva(): boolean {
  const [nueva, setNueva] = useState(false)
  useEffect(() => {
    if (import.meta.env.DEV) return
    let vigente = true
    const revisar = () =>
      void fetch(`/version.json?t=${Date.now()}`, { cache: 'no-store' })
        .then((r) => (r.ok ? r.json() : null))
        .then((d: { version?: string } | null) => {
          if (vigente && d?.version && d.version !== __VERSION__) setNueva(true)
        })
        .catch(() => undefined)
    revisar()
    const id = window.setInterval(revisar, CADA_MS)
    const alVolver = () => document.visibilityState === 'visible' && revisar()
    document.addEventListener('visibilitychange', alVolver)
    return () => {
      vigente = false
      window.clearInterval(id)
      document.removeEventListener('visibilitychange', alVolver)
    }
  }, [])
  return nueva
}
