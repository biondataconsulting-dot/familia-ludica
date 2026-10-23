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
  /** Música y sonidos: los (hasta 3) de la noche, y prender (id) o apagar (null) el que suena. */
  setSonidos: (eventId: string, ids: string[]) => llamar('admin_set_sonidos', { p_event_id: eventId, p_ids: ids }),
  sonido: (eventId: string, itemId: string | null) => llamar('admin_sonido', { p_event_id: eventId, p_item_id: itemId }),
  /** Cuántos proyectores con sonido están abiertos ahora (2 o más = se escucha doble). */
  proyectores: (eventId: string) => llamar<number>('admin_proyectores', { p_event_id: eventId }),
  /** Vuelve a poner en vivo una noche terminada (del podio al ranking) para jugar más bloques. */
  resume: (eventId: string) => llamar('admin_resume_event', { p_event_id: eventId }),
  /** Mostrar u ocultar el QR (sobre el logo) y "Cómo va la noche"; null = no lo cambia. */
  pantalla: (eventId: string, qr: boolean | null, ranking: boolean | null) =>
    llamar('admin_pantalla', { p_event_id: eventId, p_qr: qr, p_ranking: ranking }),
  listTeams: (eventId: string) => llamar<MesaAdmin[]>('admin_list_teams', { p_event_id: eventId }),
  manualPoints: (eventId: string, teamId: string, puntos: number, motivo: string) =>
    llamar('admin_manual_points', { p_event_id: eventId, p_team_id: teamId, p_points: puntos, p_reason: motivo }),
  voidEntry: (entryId: string) => llamar('admin_void_entry', { p_entry_id: entryId }),
  setValidation: (answerId: string, campo: 'titulo' | 'artista' | 'respuesta', valor: 'aceptada' | 'rechazada') =>
    llamar('admin_set_validation', { p_answer_id: answerId, p_field: campo, p_value: valor }),
  /** Oveja Oveja (respuestas cerradas): juntar un grupo con otro o dejar una respuesta sola. */
  ovejaJuntar: (blockItemId: string, desde: string, hacia: string) =>
    llamar('admin_oveja_juntar', { p_block_item_id: blockItemId, p_desde: desde, p_hacia: hacia }),
  ovejaSeparar: (answerId: string) => llamar('admin_oveja_separar', { p_answer_id: answerId }),
  unvoidEntry: (entryId: string) => llamar('admin_unvoid_entry', { p_entry_id: entryId }),
  /** Borra mesas, respuestas y puntos y vuelve a la portada. Pide el código de la noche como confirmación. */
  resetEvent: (eventId: string, codigo: string) => llamar('admin_reset_event', { p_event_id: eventId, p_code: codigo }),
  deleteEvent: (eventId: string, codigo: string) => llamar('admin_delete_event', { p_event_id: eventId, p_code: codigo }),
  // Contenido (paso 10)
  saveItem: (item: Record<string, unknown>) => llamar<string>('admin_save_item', { p: item }),
  deleteItem: (id: string) => llamar('admin_delete_item', { p_id: id }),
  importItems: (items: unknown[], estado: 'aprobado' | 'sugerido', blockId: string | null) =>
    llamar<{ importados?: number; ids?: string[]; errores?: { fila: number; error: string }[] }>('admin_import_items', {
      p_items: items,
      p_status: estado,
      p_block_id: blockId,
    }),
  saveEvent: (evento: Record<string, unknown>) => llamar<string>('admin_save_event', { p: evento }),
  duplicateEvent: (eventId: string, nombre: string, codigo: string, fecha: string | null) =>
    llamar<string>('admin_duplicate_event', { p_event_id: eventId, p_name: nombre, p_code: codigo, p_date: fecha }),
  saveBlock: (bloque: Record<string, unknown>) => llamar<string>('admin_save_block', { p: bloque }),
  deleteBlock: (blockId: string) => llamar('admin_delete_block', { p_block_id: blockId }),
  moveBlock: (blockId: string, delta: -1 | 1) => llamar('admin_move_block', { p_block_id: blockId, p_delta: delta }),
  setBlockItems: (blockId: string, itemIds: string[]) => llamar('admin_set_block_items', { p_block_id: blockId, p_item_ids: itemIds }),
  /** Puntos provisorios del ítem actual (× multiplicador), sin registrar nada. */
  preview: (eventId: string) =>
    llamar<{ team_id: string; points: number; detail: Record<string, unknown> | null }[]>('admin_preview', { p_event_id: eventId }),
}
