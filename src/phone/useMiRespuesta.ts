import { useCallback, useEffect, useState } from 'react'
import type { Respuesta } from '../dynamics/tipos'
import { whoami } from '../lib/rpc'

/**
 * La respuesta que esta mesa ya envió al ítem actual. Al cambiar de ítem (o al recargar)
 * la pide a la base con whoami, así "¡Respuesta enviada!" sobrevive a una recarga.
 */
export function useMiRespuesta(token: string, blockItemId: string | undefined) {
  const [guardada, setGuardada] = useState<{ item: string; respuesta: Respuesta } | null>(null)

  useEffect(() => {
    if (!blockItemId) return
    let activo = true
    whoami(token)
      .then((w) => {
        if (activo && w.block_item_id === blockItemId && w.answer && typeof w.answer === 'object') {
          setGuardada({ item: blockItemId, respuesta: w.answer as Respuesta })
        }
      })
      .catch(() => {
        /* sin red: se reintenta al cambiar de ítem; lo enviado igual quedó en la base */
      })
    return () => {
      activo = false
    }
  }, [token, blockItemId])

  const registrar = useCallback((item: string, respuesta: Respuesta) => setGuardada({ item, respuesta }), [])
  const respuesta = guardada && guardada.item === blockItemId ? guardada.respuesta : null
  return { respuesta, registrar }
}
