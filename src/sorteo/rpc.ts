import { ErrorRpc } from '../lib/rpc'
import { supabase } from '../lib/supabase'

/** Sorteo de la noche (un bloque por noche): participantes, premios y la ruleta. El azar lo pone la base. */

export type Persona = { id: string; nombre: string; dato: string | null }

/** Lo que ven proyector y celulares. `ultimo.at` y `server_now` sincronizan el giro de la ruleta. */
export type SorteoPublico = {
  server_now: string
  giro_segundos: number
  premios: { id: string; nombre: string; imagen: string | null; ganador: { nombre: string; dato: string | null } | null }[]
  /** Los que todavía pueden salir, más el último que salió (para que la ruleta caiga en él). */
  rueda: Persona[]
  participantes: number
  ultimo: {
    id: string
    premio_id: string
    participante_id: string
    nombre: string
    dato: string | null
    estado: 'ganador' | 'ausente'
    at: string
  } | null
}

export type ParticipanteAdmin = Persona & { ausente: boolean; created_at: string }
export type PremioAdmin = { id: string; position: number; nombre: string; imagen: string | null }
export type SorteoAdmin = {
  participantes: ParticipanteAdmin[]
  premios: PremioAdmin[]
  sorteos: { id: string; prize_id: string; participant_id: string; estado: 'ganador' | 'ausente'; created_at: string }[]
}

async function llamar<T = null>(fn: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.rpc(fn, args)
  if (error) {
    const sinConexion = !error.code
    throw new ErrorRpc(sinConexion ? 'Sin conexión. Revisá el Wi-Fi y probá de nuevo.' : error.message, error.code, sinConexion)
  }
  return data as T
}

export const getSorteo = (codigo: string) => llamar<SorteoPublico>('get_sorteo', { p_code: codigo })

/** Panel: lectura directa de las tablas (RLS: solo admins) y RPC para cambiar. */
export const sorteoAdmin = {
  async leer(eventId: string): Promise<SorteoAdmin> {
    const [p, r, d] = await Promise.all([
      supabase.from('raffle_participants').select('id, nombre, dato, ausente, created_at').eq('event_id', eventId).order('created_at').order('id'),
      supabase.from('raffle_prizes').select('id, position, nombre, imagen').eq('event_id', eventId).order('position'),
      supabase.from('raffle_draws').select('id, prize_id, participant_id, estado, created_at').eq('event_id', eventId).order('created_at'),
    ])
    const error = p.error ?? r.error ?? d.error
    if (error) throw new ErrorRpc('No se pudo leer el sorteo. Revisá la conexión.', error.code)
    return { participantes: p.data ?? [], premios: r.data ?? [], sorteos: d.data ?? [] } as SorteoAdmin
  },
  agregar: (eventId: string, lista: { nombre: string; dato?: string }[]) =>
    llamar<{ agregados: number; repetidos: string[] }>('admin_sorteo_agregar', { p_event_id: eventId, p_lista: lista }),
  quitar: (id: string) => llamar('admin_sorteo_quitar', { p_participant_id: id }),
  vaciar: (eventId: string) => llamar('admin_sorteo_vaciar', { p_event_id: eventId }),
  premio: (p: { id?: string; event_id: string; nombre: string; imagen: string }) => llamar<string>('admin_sorteo_premio', { p }),
  premioBorrar: (id: string) => llamar('admin_sorteo_premio_borrar', { p_prize_id: id }),
  premioMover: (id: string, delta: -1 | 1) => llamar('admin_sorteo_premio_mover', { p_prize_id: id, p_delta: delta }),
  sortear: (eventId: string) => llamar<{ draw_id: string; premio: string }>('admin_sorteo_sortear', { p_event_id: eventId }),
  ausente: (drawId: string) => llamar('admin_sorteo_ausente', { p_draw_id: drawId }),
}
