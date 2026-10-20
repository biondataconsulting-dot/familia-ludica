import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { formatearFecha } from '../../lib/fechas'
import { supabase } from '../../lib/supabase'
import type { EventoPublico } from '../../lib/tipos'

const ESTADOS: Record<EventoPublico['status'], string> = {
  borrador: 'Borrador',
  listo: 'Lista',
  en_vivo: 'En vivo',
  terminado: 'Terminada',
}

/** Inicio del panel: las noches, con acceso al vivo y a los enlaces de proyector y celular. (Armado: paso 10.) */
export default function AdminInicio({ nombre }: { nombre: string }) {
  const primerNombre = nombre.split(/[\s@]/)[0]
  const [eventos, setEventos] = useState<EventoPublico[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    supabase
      .from('events')
      .select('id, name, date, venue, code, status, settings')
      .order('date', { ascending: false })
      .then(({ data, error: e }) => {
        if (e) setError('No pudimos leer las noches. Revisá la conexión y recargá.')
        else setEventos(data as EventoPublico[])
      })
  }, [])

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-bold">¡Hola, {primerNombre}!</h1>
        <p className="mt-1 text-profundo/70">Elegí la noche que vas a conducir.</p>
      </div>

      {error && <p className="rounded-xl bg-naranja/10 px-4 py-3 font-semibold">{error}</p>}
      {eventos?.length === 0 && <p className="text-profundo/70">Todavía no hay noches cargadas.</p>}

      <ul className="grid gap-4 md:grid-cols-2">
        {eventos?.map((ev) => (
          <li key={ev.id} className="flex flex-col gap-3 rounded-carta bg-white p-5 shadow-md">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-xl font-bold">{ev.name}</h2>
                <p className="text-sm text-profundo/70">
                  {[formatearFecha(ev.date), ev.venue, ev.code].filter(Boolean).join(' · ')}
                </p>
              </div>
              <span className="rounded-full bg-crema px-3 py-1 text-xs font-bold">{ESTADOS[ev.status]}</span>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link to={`/admin/vivo/${ev.id}`} className="boton-principal inline-flex items-center px-5 py-2 text-base">
                Conducir en vivo
              </Link>
              <EnlaceCopiable etiqueta="Proyector" ruta={`/pantalla/${ev.code}`} />
              <EnlaceCopiable etiqueta="Celular" ruta={`/jugar/${ev.code}`} />
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}

function EnlaceCopiable({ etiqueta, ruta }: { etiqueta: string; ruta: string }) {
  const [copiado, setCopiado] = useState(false)
  const url = window.location.origin + ruta
  return (
    <span className="inline-flex overflow-hidden rounded-carta border-2 border-profundo/15">
      <a href={ruta} target="_blank" rel="noreferrer" className="flex min-h-toque items-center px-3 font-semibold hover:bg-crema">
        {etiqueta} ↗
      </a>
      <button
        onClick={() => {
          void navigator.clipboard?.writeText(url).then(() => {
            setCopiado(true)
            window.setTimeout(() => setCopiado(false), 1500)
          })
        }}
        className="border-l-2 border-profundo/15 px-3 text-sm font-semibold hover:bg-crema"
        title={url}
      >
        {copiado ? '¡Copiado!' : 'Copiar'}
      </button>
    </span>
  )
}
