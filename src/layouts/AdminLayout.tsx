import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

type Props = {
  /** Con sesión de admin: nombre visible y botón Salir en la barra. */
  usuario?: { nombre: string; email: string }
  onSalir?: () => void
  children: ReactNode
}

/**
 * Panel del conductor: barra superior y contenido a ancho completo (notebook primero).
 * En la barra va el nombre en texto, no el logo: el manual no permite el logo completo por debajo de 140 px.
 */
export function AdminLayout({ usuario, onSalir, children }: Props) {
  return (
    <div className="min-h-screen bg-crema">
      <header className="border-b border-profundo/10 bg-white">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3">
          <Link to="/admin" className="font-bold text-azul">
            Familia Lúdica
          </Link>
          <p className="font-titulo text-xl font-semibold">Panel del conductor</p>
          {usuario && (
            <div className="ml-auto flex items-center gap-3">
              <span className="hidden text-sm text-profundo/70 sm:inline" title={usuario.email}>
                {usuario.nombre}
              </span>
              <button
                onClick={onSalir}
                className="min-h-toque rounded-carta border-2 border-profundo/15 px-4 font-semibold hover:bg-crema"
              >
                Salir
              </button>
            </div>
          )}
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6">{children}</main>
    </div>
  )
}
