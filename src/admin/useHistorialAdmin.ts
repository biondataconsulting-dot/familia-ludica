import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export type Movimiento = {
  id: string
  team_id: string
  points: number
  reason: string
  origin: 'auto' | 'manual'
  voided: boolean
  created_at: string
  teams: { name: string } | null
}

/** Movimientos de puntos de la noche (el conductor los lee por RLS), los más nuevos primero. */
export function useHistorialAdmin(eventId: string, senal: unknown) {
  const [movimientos, setMovimientos] = useState<Movimiento[]>([])

  const cargar = useCallback(async () => {
    const { data, error } = await supabase
      .from('score_entries')
      .select('id, team_id, points, reason, origin, voided, created_at, teams(name)')
      .eq('event_id', eventId)
      .order('created_at', { ascending: false })
      .limit(200)
    if (!error) setMovimientos(data as unknown as Movimiento[])
  }, [eventId])

  useEffect(() => {
    void cargar()
  }, [cargar, senal])

  return { movimientos, recargar: cargar }
}
