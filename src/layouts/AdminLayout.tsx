import { useVersionNueva } from '../lib/useVersionNueva'
import type { ReactNode } from 'react'
import { Link, NavLink } from 'react-router-dom'

type Props = {
  /** Con sesión de admin: nombre visible, navegación y botón Salir en la barra. */
  usuario?: { nombre: string; email: string }
  onSalir?: () => void
  children: ReactNode
}

const SECCIONES = [
  { a: '/admin', texto: 'Noches', exacto: true },
  { a: '/admin/catalogo', texto: 'Catálogo', exacto: false },
  { a: '/admin/importar', texto: 'Importar', exacto: false },
  { a: '/admin/historial', texto: 'Historial', exacto: false },
]

/**
 * Panel del conductor: barra superior y contenido a ancho completo (notebook primero).
 * En la barra va el nombre en texto, no el logo: el manual no permite el logo completo por debajo de 140 px.
 */
export function AdminLayout({ usuario, onSalir, children }: Props) {
  const nueva = useVersionNueva()
  return (
    <div className="min-h-screen bg-crema">
      {nueva && (
        <button onClick={() => window.location.reload()} className="block w-full bg-naranja px-4 py-2 text-center font-bold text-white">
          Hay una versión nueva de la app: tocá acá para recargar el panel. Recargá también el proyector (F5).
        </button>
      )}
      <header className="border-b border-profundo/10 bg-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
          <Link to="/admin" className="font-bold text-azul">
            Familia Lúdica
          </Link>
          <p className="font-titulo text-xl font-semibold">Panel del conductor</p>
          {usuario && (
            <nav className="flex gap-1" aria-label="Secciones">
              {SECCIONES.map((s) => (
                <NavLink
                  key={s.a}
                  to={s.a}
                  end={s.exacto}
                  className={({ isActive }) =>
                    `rounded-lg px-3 py-1.5 text-sm font-semibold ${isActive ? 'bg-azul text-white' : 'text-profundo/70 hover:bg-crema'}`
                  }
                >
                  {s.texto}
                </NavLink>
              ))}
            </nav>
          )}
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
