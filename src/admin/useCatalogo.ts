import { useCallback, useEffect, useState } from 'react'
import type { TipoItem } from '../content/validarItem'
import { supabase } from '../lib/supabase'

export type ItemCatalogo = {
  id: string
  type: TipoItem
  content: Record<string, unknown>
  solution: Record<string, unknown>
  status: 'borrador' | 'sugerido' | 'aprobado'
  difficulty: string | null
  source: string | null
  tags: string[]
  used_in_events: string[]
  created_at: string
}

type Fila = Omit<ItemCatalogo, 'solution' | 'tags'> & {
  catalog_solutions: { solution: Record<string, unknown> } | { solution: Record<string, unknown> }[] | null
  item_tags: { tags: { name: string } | null }[]
}

/** Catálogo completo con soluciones y etiquetas (lo lee el conductor por RLS). */
export function useCatalogo() {
  const [items, setItems] = useState<ItemCatalogo[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  const cargar = useCallback(async () => {
    const { data, error: e } = await supabase
      .from('catalog_items')
      .select('id, type, content, status, difficulty, source, used_in_events, created_at, catalog_solutions(solution), item_tags(tags(name))')
      .order('created_at', { ascending: false })
    if (e) {
      setError('No pudimos leer el catálogo. Revisá la conexión y recargá.')
      return
    }
    setError(null)
    setItems(
      (data as unknown as Fila[]).map(({ catalog_solutions, item_tags, ...i }) => ({
        ...i,
        solution: (Array.isArray(catalog_solutions) ? catalog_solutions[0]?.solution : catalog_solutions?.solution) ?? {},
        tags: item_tags.map((t) => t.tags?.name).filter((x): x is string => Boolean(x)).sort(),
      })),
    )
  }, [])

  useEffect(() => {
    void cargar()
  }, [cargar])

  return { items, error, recargar: cargar }
}

/** Texto corto para listar un ítem: la consigna o, en canciones, "año · título · artista". */
export function resumenItem(type: string, content: Record<string, unknown>, solution: Record<string, unknown>): string {
  if (type === 'trio_verdad_mentira') return (Array.isArray(content.afirmaciones) ? content.afirmaciones : []).join(' / ')
  if (type === 'pista_audio' || type === 'clip_video') {
    return [solution.anio, solution.titulo, solution.artista].filter(Boolean).join(' · ')
  }
  if (type === 'sonido') return `🎵 ${String(content.titulo ?? '')}${content.repetir ? ' (en bucle)' : ''}`
  if (type === 'imagen_adivinar') {
    const juego = { emojis: `Emojis ${String(content.emojis ?? '')}`, logo: 'Logo', que_ves: '¿Qué ves?' }[String(content.estilo)] ?? 'Imagen'
    return `${juego} → ${String(solution.respuesta ?? '')}`
  }
  return String(content.texto ?? '')
}
