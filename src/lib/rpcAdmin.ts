import { ErrorRpc } from './rpc'
import { supabase } from './supabase'

/** RPC del conductor. Requieren sesión de admin (la base lo verifica en cada llamada). */
async function llamar<T = null>(fn: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.rpc(fn, args)
  if (error) {
    const sinConexion = !error.code
    throw new ErrorRpc(
      sinConexion ? 'Sin conexión. Revisá el Wi-Fi y probá de nuevo.' : error.message,
      error.code,
      sinConexion,
    )
  }
  return data as T
}

export type MesaAdmin = { id: string; name: string; pin: string; active: boolean; last_seen: string | null; connected: boolean }

export const admin = {
  startEvent: (eventId: string) => llamar('admin_start_event', { p_event_id: eventId }),
  startBlock: (eventId: string, blockId: string) => llamar('admin_start_block', { p_event_id: eventId, p_block_id: blockId }),
  openItem: (eventId: string, blockItemId: string, timerSeconds: number | null = null) =>
    llamar('admin_open_item', { p_event_id: eventId, p_block_item_id: blockItemId, p_timer_seconds: timerSeconds }),
  addTime: (eventId: string, segundos: number) => llamar('admin_add_time', { p_event_id: eventId, p_seconds: segundos }),
  closeItem: (eventId: string) => llamar('admin_close_item', { p_event_id: eventId }),
  reopenItem: (eventId: string) => llamar('admin_reopen_item', { p_event_id: eventId }),
  reveal: (eventId: string) => llamar('admin_reveal', { p_event_id: eventId }),
  next: (eventId: string) => llamar('admin_next', { p_event_id: eventId }),
  showBlockRanking: (eventId: string) => llamar('admin_show_block_ranking', { p_event_id: eventId }),
  finish: (eventId: string) => llamar('admin_finish', { p_event_id: eventId }),
  listTeams: (eventId: string) => llamar<MesaAdmin[]>('admin_list_teams', { p_event_id: eventId }),
}
