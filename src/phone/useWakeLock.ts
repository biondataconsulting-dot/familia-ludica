import { useEffect } from 'react'

/** Mantiene la pantalla encendida mientras `activo`, si el navegador lo permite. */
export function useWakeLock(activo: boolean) {
  useEffect(() => {
    if (!activo || !('wakeLock' in navigator)) return
    let lock: WakeLockSentinel | null = null
    let vigente = true

    const pedir = async () => {
      try {
        const nuevo = await navigator.wakeLock.request('screen')
        if (vigente) lock = nuevo
        else void nuevo.release()
      } catch {
        /* sin permiso o batería baja: no pasa nada */
      }
    }
    // El navegador lo suelta al pasar a segundo plano: se vuelve a pedir al volver.
    const alVolver = () => {
      if (document.visibilityState === 'visible') void pedir()
    }

    void pedir()
    document.addEventListener('visibilitychange', alVolver)
    return () => {
      vigente = false
      document.removeEventListener('visibilitychange', alVolver)
      void lock?.release()
    }
  }, [activo])
}
