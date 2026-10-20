import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Logo } from '../components/Logo'

/** Panel del conductor: barra con logo y contenido a ancho completo (notebook primero). */
export function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-crema">
      <header className="border-b border-profundo/10 bg-white">
        <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-3">
          <Link to="/admin" aria-label="Inicio del panel">
            <Logo className="h-10 w-16 p-1 shadow-none" />
          </Link>
          <p className="font-titulo text-xl font-semibold">Panel del conductor</p>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6">{children}</main>
    </div>
  )
}
