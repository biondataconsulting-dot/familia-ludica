import { useEffect, useState } from 'react'
import { admin, type MesaAdmin } from '../lib/rpcAdmin'

/** Mesas con PIN y conexión. Se relee cuando cambia el estado en vivo y cada 5 s. */
export function useMesasAdmin(eventId: string, senal: unknown) {
  const [mesas, setMesas] = useState<MesaAdmin[]>([])

  useEffect(() => {
    let activo = true
    const cargar = () =>
      admin
        .listTeams(eventId)
        .then((m) => activo && setMesas(m))
        .catch(() => {
          /* se reintenta en el próximo ciclo */
        })
    void cargar()
    const id = window.setInterval(cargar, 5000)
    return () => {
      activo = false
      window.clearInterval(id)
    }
  }, [eventId, senal])

  return mesas
}
