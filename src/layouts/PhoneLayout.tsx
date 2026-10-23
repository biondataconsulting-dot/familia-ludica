import { useVersionNueva } from '../lib/useVersionNueva'
import type { ReactNode } from 'react'

type Props = {
  /** Nombre de la mesa; vacío hasta que se registre. */
  mesa?: string
  pin?: string
  dinamica?: string
  /** Se perdió la conexión: banda "Reconectando…" sin tocar lo que hay en pantalla. */
  reconectando?: boolean
  children: ReactNode
}

/** Celular de mesa: barra superior permanente con mesa, dinámica y PIN; un solo foco por pantalla. */
export function PhoneLayout({ mesa, pin, dinamica, reconectando = false, children }: Props) {
  const nueva = useVersionNueva()
  return (
    <div className="flex min-h-screen min-h-[100dvh] flex-col bg-crema">
      <header className="sticky top-0 z-10 bg-azul text-white shadow-md">
        <div className="mx-auto flex max-w-md items-center gap-3 px-4 py-2">
          <div className="min-w-0 flex-1">
            <p className="truncate font-titulo text-lg font-semibold leading-tight">{mesa || 'Tu mesa'}</p>
            {dinamica && <p className="truncate text-sm text-white/80">{dinamica}</p>}
          </div>
          {pin && (
            <div className="rounded-xl bg-white/15 px-3 py-1 text-right">
              <p className="text-[0.65rem] font-bold uppercase tracking-wider text-white/70">PIN</p>
              <p className="font-titulo text-lg font-semibold leading-none tracking-widest">{pin}</p>
            </div>
          )}
        </div>
        {nueva && (
          <button onClick={() => window.location.reload()} className="block w-full bg-naranja px-4 py-1 text-center text-sm font-bold">
            Hay una versión nueva: tocá acá para actualizar
          </button>
        )}
        {reconectando && (
          <p role="status" className="bg-naranja px-4 py-1 text-center text-sm font-bold">
            Reconectando…
          </p>
        )}
      </header>
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col px-4 py-6">{children}</main>
    </div>
  )
}
