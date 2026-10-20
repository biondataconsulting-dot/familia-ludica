import type { ReactNode } from 'react'
import { Route, Routes } from 'react-router-dom'
import { useSesionAdmin } from '../auth/useSesionAdmin'
import { Logo } from '../components/Logo'
import { AdminLayout } from '../layouts/AdminLayout'
import AdminCatalogo from './admin/AdminCatalogo'
import AdminImportar from './admin/AdminImportar'
import AdminInicio from './admin/AdminInicio'
import AdminItem from './admin/AdminItem'
import AdminNoche from './admin/AdminNoche'
import AdminVivo from './admin/AdminVivo'

/** Guard de /admin/*: solo pasan los emails de la tabla admins. */
export default function Admin() {
  const { estado, entrar, salir, reintentar } = useSesionAdmin()

  if (estado.tipo === 'admin') {
    return (
      <AdminLayout usuario={estado} onSalir={salir}>
        <Routes>
          <Route index element={<AdminInicio nombre={estado.nombre} />} />
          <Route path="vivo/:eventId" element={<AdminVivo />} />
          <Route path="noche/:eventId" element={<AdminNoche />} />
          <Route path="catalogo" element={<AdminCatalogo />} />
          <Route path="catalogo/:itemId" element={<AdminItem />} />
          <Route path="importar" element={<AdminImportar />} />
          <Route path="*" element={<AdminInicio nombre={estado.nombre} />} />
        </Routes>
      </AdminLayout>
    )
  }

  return (
    <AdminLayout>
      {estado.tipo === 'cargando' && (
        <Tarjeta titulo="Un momento…">
          <p className="mt-2 text-profundo/70">Estamos revisando tu sesión.</p>
        </Tarjeta>
      )}

      {estado.tipo === 'anonimo' && (
        <Tarjeta titulo="Hola, conductor">
          <p className="mt-2 text-profundo/70">Entrá con tu cuenta de Google para preparar y conducir la noche.</p>
          {estado.error && <Aviso>{estado.error}</Aviso>}
          <button onClick={entrar} className="boton-principal mt-6 w-full">
            Entrar con Google
          </button>
        </Tarjeta>
      )}

      {estado.tipo === 'sin_acceso' && (
        <Tarjeta titulo="Sin acceso">
          <p className="mt-2 text-profundo/70">
            La cuenta <strong className="break-all text-profundo">{estado.email}</strong> no está habilitada para
            conducir. Salí y entrá con una cuenta autorizada, o pedile acceso a quien organiza la noche.
          </p>
          <button onClick={salir} className="boton-principal mt-6 w-full">
            Salir
          </button>
        </Tarjeta>
      )}

      {estado.tipo === 'error' && (
        <Tarjeta titulo="Algo salió mal">
          <Aviso>{estado.mensaje}</Aviso>
          <button onClick={reintentar} className="boton-principal mt-6 w-full">
            Probar de nuevo
          </button>
          <button onClick={salir} className="mt-3 min-h-toque w-full font-semibold text-profundo/70 underline">
            Salir
          </button>
        </Tarjeta>
      )}
    </AdminLayout>
  )
}

function Tarjeta({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <div className="mx-auto mt-6 max-w-md rounded-carta bg-white p-8 text-center shadow-md">
      <Logo className="mx-auto w-40" />
      <h1 className="mt-2 text-3xl font-bold">{titulo}</h1>
      {children}
    </div>
  )
}

function Aviso({ children }: { children: ReactNode }) {
  return (
    <p role="alert" className="mt-4 rounded-xl bg-naranja/10 px-4 py-3 text-left text-sm font-semibold text-profundo">
      {children}
    </p>
  )
}
