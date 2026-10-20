import type { ReactNode } from 'react'
import { Logo } from '../components/Logo'

/**
 * Escenario 16:9 centrado en la ventana. Pensado para 1920×1080; escala con cqw.
 * Siempre: logo chico sobre panel blanco en una esquina y patrón de puntos.
 */
export function ProjectorLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-screen h-[100dvh] w-screen items-center justify-center overflow-hidden bg-profundo">
      <div className="escenario fondo-puntos relative overflow-hidden text-white">
        {children}
        <Logo className="absolute right-[1.5cqw] top-[1.5cqw] h-[6cqw] w-[9cqw] p-[0.6cqw]" />
      </div>
    </div>
  )
}
