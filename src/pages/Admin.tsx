import { Logo } from '../components/Logo'
import { AdminLayout } from '../layouts/AdminLayout'

/** Panel del conductor. Por ahora, maqueta (paso 1); el login con Google llega en el paso 3. */
export default function Admin() {
  return (
    <AdminLayout>
      <div className="mx-auto max-w-md rounded-carta bg-white p-8 text-center shadow-md">
        <Logo className="mx-auto w-40" />
        <h1 className="text-3xl font-bold">Hola, conductor</h1>
        <p className="mt-2 text-profundo/70">Desde acá vas a preparar y conducir la noche.</p>
        <button disabled className="boton-principal mt-6 w-full">
          Entrar con Google
        </button>
        <div className="mt-6 flex justify-center gap-2" aria-hidden>
          {['bg-naranja', 'bg-azul', 'bg-celeste', 'bg-profundo', 'bg-crema border', 'bg-amarillo'].map((c) => (
            <span key={c} className={`h-6 w-6 rounded-full border-profundo/20 ${c}`} />
          ))}
        </div>
      </div>
    </AdminLayout>
  )
}
