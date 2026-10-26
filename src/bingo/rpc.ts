import { ErrorRpc } from '../lib/rpc'
import { supabase } from '../lib/supabase'
import type { Carton, TipoBingo } from './formato'

/** Bingo musical: set de canciones numeradas, cartones y bolillas (las saca la base). */

export type CancionSet = {
  number: number
  catalog_item_id: string
  inicio: number
  duracion: number
  titulo_carton: string | null
  /** Del catálogo (solo lo lee el conductor). */
  titulo: string
  artista: string
  youtube_id: string
}
export type SetBingo = { id: string; name: string; created_at: string }
export type CartonGuardado = { numero: number; tipo: TipoBingo; filas: Carton }

/**
 * Lo que ven proyector y celulares. Número, título y artista recién cuando se revela la bolilla (terminó el
 * fragmento o el conductor tocó «Revelar ya»): el número está impreso en el cartón.
 */
export type BingoPublico = {
  server_now: string
  tipo: TipoBingo
  pool: number
  bolillas: { number: number | null; position: number; at: string; duracion: number; revelada: boolean; extendida: boolean; cortada: boolean; titulo?: string; artista?: string }[]
}
export type MediaBingo = { id: string; at: string; youtube_id: string; inicio: number; duracion: number; extendida: boolean; cortada: boolean }
export type Verificacion = {
  numero: number
  tipo: TipoBingo
  filas: { number: number; salio: boolean; titulo: string; artista: string }[][]
  lineas: number
  bingo: boolean
  bolillas: number
}

async function llamar<T = null>(fn: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.rpc(fn, args)
  if (error) {
    const sinConexion = !error.code
    throw new ErrorRpc(sinConexion ? 'Sin conexión. Revisá el Wi-Fi y probá de nuevo.' : error.message, error.code, sinConexion)
  }
  return data as T
}

export const getBingo = (codigo: string) => llamar<BingoPublico | null>('get_bingo', { p_code: codigo })
export const proyectorBingo = (codigo: string) => llamar<MediaBingo | null>('proyector_bingo', { p_code: codigo })

type FilaCancion = Omit<CancionSet, 'titulo' | 'artista' | 'youtube_id'> & {
  catalog_items: { content: Record<string, unknown>; catalog_solutions: { solution: Record<string, unknown> } | { solution: Record<string, unknown> }[] | null } | null
}

export const bingoAdmin = {
  sets: async (): Promise<SetBingo[]> => {
    const { data, error } = await supabase.from('bingo_sets').select('id, name, created_at').order('created_at')
    if (error) throw new ErrorRpc('No se pudieron leer los sets de bingo.')
    return data as SetBingo[]
  },
  set: async (id: string): Promise<{ set: SetBingo; canciones: CancionSet[]; cartones: CartonGuardado[] }> => {
    const [s, c, k] = await Promise.all([
      supabase.from('bingo_sets').select('id, name, created_at').eq('id', id).maybeSingle(),
      supabase
        .from('bingo_songs')
        .select('number, catalog_item_id, inicio, duracion, titulo_carton, catalog_items(content, catalog_solutions(solution))')
        .eq('set_id', id)
        .order('number'),
      supabase.from('bingo_cards').select('numero, tipo, filas').eq('set_id', id).order('tipo').order('numero'),
    ])
    if (s.error || c.error || k.error) throw new ErrorRpc('No se pudo leer el set. Revisá la conexión.')
    if (!s.data) throw new ErrorRpc('No encontramos ese set.', 'P0002')
    const canciones = (c.data as unknown as FilaCancion[]).map(({ catalog_items: ci, ...x }) => {
      const sol = Array.isArray(ci?.catalog_solutions) ? ci?.catalog_solutions[0]?.solution : ci?.catalog_solutions?.solution
      return {
        ...x,
        titulo: String(sol?.titulo ?? ''),
        artista: String(sol?.artista ?? ''),
        youtube_id: String(ci?.content.youtube_id ?? ''),
      }
    })
    return { set: s.data as SetBingo, canciones, cartones: k.data as CartonGuardado[] }
  },
  guardarSet: (p: { id?: string; name: string }) => llamar<string>('admin_bingo_set', { p }),
  borrarSet: (id: string) => llamar('admin_bingo_set_borrar', { p_set_id: id }),
  cancion: (p: { set_id: string; number: number; catalog_item_id: string; inicio: number; duracion: number; titulo_carton: string }) =>
    llamar('admin_bingo_cancion', { p }),
  quitarCancion: (setId: string, n: number) => llamar('admin_bingo_cancion_quitar', { p_set_id: setId, p_number: n }),
  cartones: (setId: string, tipo: TipoBingo, cartones: Carton[]) =>
    llamar<number>('admin_bingo_cartones', { p_set_id: setId, p_tipo: tipo, p_cartones: cartones }),
  borrarCartones: (setId: string, tipo: TipoBingo) => llamar('admin_bingo_cartones_borrar', { p_set_id: setId, p_tipo: tipo }),
  revelar: (eventId: string) => llamar('admin_bingo_revelar', { p_event_id: eventId }),
  extender: (eventId: string) => llamar('admin_bingo_extender', { p_event_id: eventId }),
  cortar: (eventId: string) => llamar('admin_bingo_cortar', { p_event_id: eventId }),
  sacar: (eventId: string) => llamar<{ number: number; position: number }>('admin_bingo_sacar', { p_event_id: eventId }),
  verificar: (eventId: string, numero: number) => llamar<Verificacion>('admin_bingo_verificar', { p_event_id: eventId, p_numero: numero }),
}
