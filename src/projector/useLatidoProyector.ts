import { useEffect, useState } from 'react'
import { proyectorLatido } from '../lib/rpc'

const CADA_MS = 10000

/** Con «Comenzar la noche» tocado (con sonido), el proyector late cada 10 s con un id de esta página. */
export function useLatidoProyector(codigo: string, activo: boolean) {
  const [id] = useState(() => crypto.randomUUID())
  useEffect(() => {
    if (!activo || !codigo) return
    const latir = () => void proyectorLatido(codigo, id).catch(() => undefined)
    latir()
    const t = window.setInterval(latir, CADA_MS)
    return () => window.clearInterval(t)
  }, [activo, codigo, id])
}
