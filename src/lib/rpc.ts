import { supabase } from './supabase'
import type { Live, MiMesa, Whoami } from './tipos'

/** Error de una RPC con un mensaje listo para mostrar (en español). */
export class ErrorRpc extends Error {
  constructor(
    message: string,
    /** Código de Postgres (P0002 = no encontrado: noche o mesa inexistente). */
    readonly codigo?: string,
    readonly sinConexion = false,
  ) {
    super(message)
  }
}

async function llamar<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.rpc(fn, args)
  if (error) {
    // Sin código de Postgres = no llegó a la base (red caída, timeout).
    const sinConexion = !error.code
    throw new ErrorRpc(
      sinConexion ? 'Sin conexión. Revisá el Wi-Fi o los datos y probá de nuevo.' : error.message,
      error.code,
      sinConexion,
    )
  }
  // Algunas RPC devuelven {error} en vez de lanzar (ej.: PIN incorrecto, para registrar el intento).
  if (data && typeof data === 'object' && 'error' in data && typeof data.error === 'string') {
    throw new ErrorRpc(data.error)
  }
  return data as T
}

export const getLive = (codigo: string) => llamar<Live>('get_live', { p_code: codigo })

export const joinTeam = (codigo: string, nombre: string) =>
  llamar<MiMesa>('join_team', { p_code: codigo, p_name: nombre })

export const rejoinTeam = (codigo: string, teamId: string, pin: string) =>
  llamar<MiMesa>('rejoin_team', { p_code: codigo, p_team_id: teamId, p_pin: pin })

export const whoami = (token: string) => llamar<Whoami>('whoami', { p_token: token })

export const heartbeat = (token: string) => llamar<null>('heartbeat', { p_token: token })

/** Envía (o cambia) la respuesta de la mesa al ítem abierto. Devuelve la respuesta normalizada por la base. */
export const submitAnswer = (token: string, blockItemId: string, respuesta: Record<string, unknown>) =>
  llamar<{ answer: Record<string, unknown> }>('submit_answer', {
    p_token: token,
    p_block_item_id: blockItemId,
    p_answer: respuesta,
  })
