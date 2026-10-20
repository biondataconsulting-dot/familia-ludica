/** Formas de lo que devuelven las RPC públicas (ver supabase/migrations). */

export type Fase = 'cover' | 'block_intro' | 'item_open' | 'item_closed' | 'item_revealed' | 'block_ranking' | 'final'

export type EventoPublico = {
  id: string
  name: string
  date: string | null
  venue: string | null
  code: string
  status: 'borrador' | 'listo' | 'en_vivo' | 'terminado'
  settings: { edicion?: string }
}

export type MesaPublica = { id: string; name: string; connected: boolean }

export type BloqueActual = {
  id: string
  dynamic: string
  title: string
  is_practice: boolean
  multiplier: number
  position: number
  number: number
  total_blocks: number
  total_items: number
  timer_seconds: number | null
}

export type ItemActual = {
  block_item_id: string
  position: number
  number: number
  type: string
  content: Record<string, unknown>
}

export type Live = {
  server_now: string
  event: EventoPublico
  phase: Fase
  opened_at: string | null
  timer_seconds: number | null
  extra_seconds: number
  updated_at: string | null
  revealed: unknown
  block: BloqueActual | null
  item: ItemActual | null
  answers_count: number
  /** Ids de las mesas que ya respondieron el ítem actual (nunca qué respondieron). */
  answered: string[]
  teams_count: number
  teams: MesaPublica[]
  /** Ranking de la noche, ya ordenado (sin práctica ni anulados). */
  ranking: FilaRanking[]
}

export type FilaRanking = {
  team_id: string
  name: string
  total: number
  position: number
  /** Puntos de la mesa en el bloque actual. */
  block_total: number
}

/** Credenciales de la mesa en este celular. El token es secreto: identifica a la mesa ante la base. */
export type MiMesa = { team_id: string; token: string; pin: string; name: string }

export type Whoami = MiMesa & { event_code: string; block_item_id: string | null; answer: unknown }

/** Lo que guarda admin_reveal en live_state.revealed. */
export type Revelado = {
  block_item_id: string
  solution: Record<string, unknown>
  points: { team_id: string; name: string; points: number; detail: unknown }[]
  practice: boolean
  /** Puesto de cada mesa antes de sumar este ítem (para las flechas). */
  ranking_antes?: Record<string, number>
}
