import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

/**
 * Panel del conductor: barra superior y contenido a ancho completo (notebook primero).
 * En la barra va el nombre en texto, no el logo: el manual no permite el logo completo por debajo de 140 px.
 */
export function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-crema">
      <header className="border-b border-profundo/10 bg-white">
        <div className="mx-auto flex max-w-7xl items-baseline gap-3 px-4 py-3">
          <Link to="/admin" className="font-bold text-azul">
            Familia Lúdica
          </Link>
          <p className="font-titulo text-xl font-semibold">Panel del conductor</p>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6">{children}</main>
    </div>
  )
}
