import { useCallback, useEffect, useState } from 'react'
import { ErrorRpc, heartbeat, whoami } from '../lib/rpc'
import type { MiMesa } from '../lib/tipos'

const LATIDO_MS = 10_000
const clave = (codigo: string) => `fl:mesa:${codigo.toUpperCase()}`

// localStorage puede fallar (modo privado, bloqueado): la mesa funciona igual mientras no se recargue.
function leer(codigo: string): MiMesa | null {
  try {
    const crudo = localStorage.getItem(clave(codigo))
    const m = crudo ? (JSON.parse(crudo) as Partial<MiMesa>) : null
    return m?.token && m.team_id && m.pin && m.name ? (m as MiMesa) : null
  } catch {
    return null
  }
}
function guardar(codigo: string, mesa: MiMesa) {
  try {
    localStorage.setItem(clave(codigo), JSON.stringify(mesa))
  } catch {
    /* sin almacenamiento: seguimos en memoria */
  }
}
function borrar(codigo: string) {
  try {
    localStorage.removeItem(clave(codigo))
  } catch {
    /* nada que borrar */
  }
}

const esMesaInexistente = (e: unknown) => e instanceof ErrorRpc && e.codigo === 'P0002'

/**
 * La mesa de este celular. Si hay una guardada entra directo; la valida con whoami y la mantiene
 * "conectada" con un latido cada 10 s. Si la base ya no la reconoce (reinicio de la noche), la olvida.
 */
export function useMiMesa(codigo: string) {
  const [mesa, setMesa] = useState<MiMesa | null>(() => leer(codigo))

  const entrar = useCallback(
    (m: MiMesa) => {
      guardar(codigo, m)
      setMesa(m)
    },
    [codigo],
  )
  const olvidar = useCallback(() => {
    borrar(codigo)
    setMesa(null)
  }, [codigo])

  const token = mesa?.token
  useEffect(() => {
    if (!token) return
    let activo = true
    const siNoExiste = (e: unknown) => {
      if (activo && esMesaInexistente(e)) olvidar()
    }

    whoami(token)
      .then((w) => activo && entrar({ team_id: w.team_id, token: w.token, pin: w.pin, name: w.name }))
      .catch(siNoExiste)

    const latir = () => void heartbeat(token).catch(siNoExiste)
    const intervalo = window.setInterval(latir, LATIDO_MS)
    const alVolver = () => {
      if (document.visibilityState === 'visible') latir()
    }
    document.addEventListener('visibilitychange', alVolver)
    return () => {
      activo = false
      window.clearInterval(intervalo)
      document.removeEventListener('visibilitychange', alVolver)
    }
  }, [token, entrar, olvidar])

  return { mesa, entrar, olvidar }
}
