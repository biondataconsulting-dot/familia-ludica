import type { ReactNode } from 'react'
import { Logo } from '../components/Logo'

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
  return (
    <div className="flex h-screen h-[100dvh] w-screen items-center justify-center overflow-hidden bg-profundo">
      <div className="escenario fondo-puntos relative overflow-hidden text-white">
        {children}
        {logoEsquina && <Logo className="absolute right-[1.5cqw] top-[1.5cqw] w-[max(140px,7.5cqw)]" />}
      </div>
    </div>
  )
}
