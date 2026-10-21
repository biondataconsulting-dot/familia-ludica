import { useEffect, useState } from 'react'
import { admin } from '../lib/rpcAdmin'

/** Cuántos proyectores con sonido hay abiertos (consulta cada 10 s; null mientras no se sabe). */
export function useProyectores(eventId: string): number | null {
  const [n, setN] = useState<number | null>(null)
  useEffect(() => {
    let vigente = true
    const leer = () =>
      void admin
        .proyectores(eventId)
        .then((x) => vigente && setN(x))
        .catch(() => undefined)
    leer()
    const id = window.setInterval(leer, 10000)
    return () => {
      vigente = false
      window.clearInterval(id)
    }
  }, [eventId])
  return n
}
