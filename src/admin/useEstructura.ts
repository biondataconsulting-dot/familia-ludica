import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { EventoPublico } from '../lib/tipos'

export type ItemAdmin = {
  id: string
  /** Ítem del catálogo (para reordenar o sacar del bloque). */
  catalog_item_id: string
  position: number
  tipo: string
  content: Record<string, unknown>
  /** Visible solo para el conductor (RLS: is_admin). */
  solution: Record<string, unknown> | null
}

export type BloqueAdmin = {
  id: string
  position: number
  dynamic: string
  title: string
  multiplier: number
  is_practice: boolean
  config: { timer_seconds?: number }
  items: ItemAdmin[]
}

type FilaBloque = Omit<BloqueAdmin, 'items'> & {
  block_items: {
    id: string
    position: number
    catalog_item_id: string
    catalog_items: {
      type: string
      content: Record<string, unknown>
      catalog_solutions: { solution: Record<string, unknown> } | { solution: Record<string, unknown> }[] | null
    } | null
  }[]
}

const unaSolucion = (s: FilaBloque['block_items'][number]['catalog_items']) => {
  const cs = s?.catalog_solutions
  return (Array.isArray(cs) ? cs[0]?.solution : cs?.solution) ?? null
}

/** La noche armada (bloques e ítems con solución), leída como admin. */
export function useEstructura(eventId: string) {
  const [evento, setEvento] = useState<EventoPublico | null>(null)
  const [bloques, setBloques] = useState<BloqueAdmin[]>([])
  const [error, setError] = useState<string | null>(null)

  const cargar = useCallback(async () => {
    const [ev, bl] = await Promise.all([
      supabase.from('events').select('id, name, date, venue, code, status, settings').eq('id', eventId).maybeSingle(),
      supabase
        .from('event_blocks')
        .select(
          'id, position, dynamic, title, multiplier, is_practice, config, block_items(id, position, catalog_item_id, catalog_items(type, content, catalog_solutions(solution)))',
        )
        .eq('event_id', eventId)
        .order('position')
        .order('position', { referencedTable: 'block_items' }),
    ])
    if (ev.error || bl.error) {
      setError('No pudimos leer la noche. Revisá la conexión y recargá.')
      return
    }
    if (!ev.data) {
      setError('No encontramos esta noche.')
      return
    }
    setError(null)
    setEvento(ev.data as EventoPublico)
    setBloques(
      (bl.data as unknown as FilaBloque[]).map(({ block_items, ...b }) => ({
        ...b,
        items: block_items.map((i) => ({
          id: i.id,
          catalog_item_id: i.catalog_item_id,
          position: i.position,
          tipo: i.catalog_items?.type ?? '',
          content: i.catalog_items?.content ?? {},
          solution: unaSolucion(i.catalog_items),
        })),
      })),
    )
  }, [eventId])

  useEffect(() => {
    void cargar()
  }, [cargar])

  return { evento, bloques, error, recargar: cargar }
}
