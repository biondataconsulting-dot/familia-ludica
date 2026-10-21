import { ErrorRpc } from '../lib/rpc'
import { supabase } from '../lib/supabase'

/** Módulo opcional por noche: misiones secretas (todas las mesas) y desafíos (gana la primera). */

export type EstadoExtra = 'oculto' | 'abierto' | 'cerrado'
export type TipoExtra = 'mision' | 'desafio'

/** Lo que ven las pantallas: solo lo abierto. `cumplida` solo con el token de la mesa. */
export type ExtrasPublicos = {
  misiones: { id: string; title: string; description: string | null; points: number; cumplida: boolean }[]
  desafio: { id: string; title: string; description: string | null; points: number } | null
}

export type ExtraAdmin = {
  id: string
  kind: TipoExtra
  position: number
  title: string
  description: string | null
  points: number
  status: EstadoExtra
  completions: { team_id: string; score_entry_id: string | null }[]
}

export type ExtrasAdmin = { misiones: boolean; desafios: boolean; items: ExtraAdmin[] }

async function llamar<T = null>(fn: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.rpc(fn, args)
  if (error) {
    const sinConexion = !error.code
    throw new ErrorRpc(sinConexion ? 'Sin conexión. Revisá el Wi-Fi y probá de nuevo.' : error.message, error.code, sinConexion)
  }
  return data as T
}

export const getExtras = (codigo: string, token: string | null) =>
  llamar<ExtrasPublicos>('get_extras', { p_code: codigo, p_token: token })

export const extrasAdmin = {
  leer: (eventId: string) => llamar<ExtrasAdmin>('admin_get_extras', { p_event_id: eventId }),
  activar: (eventId: string, misiones: boolean, desafios: boolean) =>
    llamar('admin_set_extras', { p_event_id: eventId, p_misiones: misiones, p_desafios: desafios }),
  guardar: (extra: { id?: string; event_id?: string; kind?: TipoExtra; title: string; description: string; points: number }) =>
    llamar<string>('admin_save_extra', { p: extra }),
  borrar: (id: string) => llamar('admin_delete_extra', { p_id: id }),
  misiones: (eventId: string, abiertas: boolean) => llamar('admin_misiones_estado', { p_event_id: eventId, p_abiertas: abiertas }),
  marcar: (extraId: string, teamId: string, cumplida: boolean) =>
    llamar('admin_mision_marcar', { p_extra_id: extraId, p_team_id: teamId, p_cumplida: cumplida }),
  lanzar: (extraId: string) => llamar('admin_desafio_lanzar', { p_extra_id: extraId }),
  cerrar: (extraId: string, teamId: string | null) => llamar('admin_desafio_cerrar', { p_extra_id: extraId, p_team_id: teamId }),
  reabrir: (extraId: string) => llamar('admin_desafio_reabrir', { p_extra_id: extraId }),
}
