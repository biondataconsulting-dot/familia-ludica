import { useCallback, useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { errorDeLoginEnUrl, supabase } from '../lib/supabase'

export type EstadoSesion =
  | { tipo: 'cargando' }
  | { tipo: 'anonimo'; error?: string }
  | { tipo: 'sin_acceso'; email: string }
  | { tipo: 'admin'; email: string; nombre: string }
  | { tipo: 'error'; mensaje: string }

const errorAlVolver = errorDeLoginEnUrl
  ? `Google no completó el ingreso (${errorDeLoginEnUrl}). Probá de nuevo.`
  : undefined
if (errorAlVolver) window.history.replaceState(null, '', window.location.pathname)

/**
 * Sesión del conductor. Admin = email en la tabla admins, verificado en la base con is_admin()
 * (la misma función que usa RLS), nunca con una lista en el frontend.
 */
export function useSesionAdmin() {
  const [estado, setEstado] = useState<EstadoSesion>({ tipo: 'cargando' })
  const [intento, setIntento] = useState(0)

  useEffect(() => {
    let activo = true
    const errorInicial = intento === 0 ? errorAlVolver : undefined

    async function evaluar(session: Session | null) {
      if (!session) {
        if (activo) setEstado({ tipo: 'anonimo', error: errorInicial })
        return
      }
      const email = session.user.email ?? ''
      const { data, error } = await supabase.rpc('is_admin')
      if (!activo) return
      if (error) {
        setEstado({ tipo: 'error', mensaje: 'No pudimos verificar tu cuenta. Revisá la conexión y probá de nuevo.' })
      } else if (data === true) {
        const meta = session.user.user_metadata as { full_name?: string; name?: string }
        setEstado({ tipo: 'admin', email, nombre: meta.full_name ?? meta.name ?? email })
      } else {
        setEstado({ tipo: 'sin_acceso', email })
      }
    }

    // INITIAL_SESSION llega apenas se suscribe. Se difiere la llamada a la base para no
    // bloquear el callback de auth (recomendación de supabase-js).
    const { data } = supabase.auth.onAuthStateChange((evento, session) => {
      if (evento === 'TOKEN_REFRESHED') return
      // Al volver de Google queda un "#" suelto en la URL.
      if (window.location.href.endsWith('#')) {
        window.history.replaceState(null, '', window.location.pathname + window.location.search)
      }
      setTimeout(() => void evaluar(session), 0)
    })
    return () => {
      activo = false
      data.subscription.unsubscribe()
    }
  }, [intento])

  const entrar = useCallback(async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin + window.location.pathname,
        queryParams: { prompt: 'select_account' },
      },
    })
    if (error) setEstado({ tipo: 'anonimo', error: 'No pudimos abrir el ingreso con Google. Probá de nuevo.' })
  }, [])

  const salir = useCallback(async () => {
    setEstado({ tipo: 'cargando' })
    await supabase.auth.signOut()
    setEstado({ tipo: 'anonimo' })
  }, [])

  const reintentar = useCallback(() => {
    setEstado({ tipo: 'cargando' })
    setIntento((n) => n + 1)
  }, [])

  return { estado, entrar, salir, reintentar }
}
