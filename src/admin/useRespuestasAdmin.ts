import { useEffect, useState } from 'react'
import { admin } from '../lib/rpcAdmin'
import { supabase } from '../lib/supabase'

export type RespuestaAdmin = {
  id: string
  team_id: string
  answer: Record<string, unknown>
  submitted_at: string
  validation: Record<string, string>
}
export type Provisorio = { team_id: string; points: number; detail: Record<string, unknown> | null }

/**
 * Respuestas del ítem actual (el conductor las ve por RLS) y puntos provisorios.
 * Se relee cuando cambia la señal (respuestas, fase) y cada 5 s.
 */
export function useRespuestasAdmin(eventId: string, blockItemId: string | undefined, senal: unknown) {
  const [respuestas, setRespuestas] = useState<RespuestaAdmin[]>([])
  const [provisorios, setProvisorios] = useState<Provisorio[]>([])

  useEffect(() => {
    if (!blockItemId) {
      setRespuestas([])
      setProvisorios([])
      return
    }
    let activo = true
    const cargar = async () => {
      const [r, p] = await Promise.all([
        supabase.from('answers').select('id, team_id, answer, submitted_at, validation').eq('block_item_id', blockItemId),
        admin.preview(eventId).catch(() => null),
      ])
      if (!activo) return
      if (!r.error) setRespuestas(r.data as RespuestaAdmin[])
      if (p) setProvisorios(p)
    }
    void cargar()
    const id = window.setInterval(() => void cargar(), 5000)
    return () => {
      activo = false
      window.clearInterval(id)
    }
  }, [eventId, blockItemId, senal])

  const [recarga, setRecarga] = useState(0)
  useEffect(() => {
    if (recarga === 0 || !blockItemId) return
    void supabase
      .from('answers')
      .select('id, team_id, answer, submitted_at, validation')
      .eq('block_item_id', blockItemId)
      .then(({ data, error }) => !error && setRespuestas(data as RespuestaAdmin[]))
    void admin.preview(eventId).then(setProvisorios).catch(() => null)
  }, [recarga, eventId, blockItemId])

  return { respuestas, provisorios, recargar: () => setRecarga((n) => n + 1) }
}
