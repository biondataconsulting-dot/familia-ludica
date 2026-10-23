import type { ReactNode } from 'react'
import { Logo } from '../components/Logo'
import { useVersionNueva } from '../lib/useVersionNueva'

type Props = {
  /** Logo chico en la esquina. Se apaga solo cuando la pantalla ya muestra el logo (portada). */
  logoEsquina?: boolean
  children: ReactNode
}

/**
 * Escenario 16:9 centrado en la ventana. Pensado para 1920×1080; escala con cqw.
 * Siempre: patrón de puntos y logo sobre panel blanco en una esquina (≥ 140 px, manual de marca).
 */
export function ProjectorLayout({ logoEsquina = true, children }: Props) {
  const nueva = useVersionNueva()
  return (
    <div className="flex h-screen h-[100dvh] w-screen items-center justify-center overflow-hidden bg-profundo">
      <div className="escenario fondo-puntos relative overflow-hidden text-white">
        {children}
        {logoEsquina && <Logo className="absolute right-[1.5cqw] top-[1.5cqw] z-20 w-[max(140px,7.5cqw)]" />}
        {nueva && (
          <p role="status" className="absolute bottom-[0.8cqw] left-1/2 z-40 -translate-x-1/2 rounded-full bg-naranja px-[1.4cqw] py-[0.3cqw] text-[1.2cqw] font-bold">
            Hay una versión nueva de la app: recargá esta pantalla (F5) y tocá «Comenzar la noche»
          </p>
        )}
      </div>
    </div>
  )
}
