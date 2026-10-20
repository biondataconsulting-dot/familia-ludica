import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { BotonPrincipal, BotonSecundario, CAMPO, Etiqueta, Mensaje } from '../../admin/ui'
import { sugerirCodigo } from '../../content/codigo'
import { formatearFecha } from '../../lib/fechas'
import { ErrorRpc } from '../../lib/rpc'
import { admin } from '../../lib/rpcAdmin'
import { supabase } from '../../lib/supabase'
import type { EventoPublico } from '../../lib/tipos'

const ESTADOS: Record<EventoPublico['status'], string> = {
  borrador: 'Borrador',
  listo: 'Lista',
  en_vivo: 'En vivo',
  terminado: 'Terminada',
}

/** Inicio del panel: las noches (crear, armar, duplicar, conducir) con los enlaces de proyector y celular. */
export default function AdminInicio({ nombre }: { nombre: string }) {
  const primerNombre = nombre.split(/[\s@]/)[0]
  const navegar = useNavigate()
  const [eventos, setEventos] = useState<EventoPublico[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [duplicando, setDuplicando] = useState<EventoPublico | null>(null)

  useEffect(() => {
    supabase
      .from('events')
      .select('id, name, date, venue, code, status, settings')
      .order('date', { ascending: false, nullsFirst: true })
      .then(({ data, error: e }) => {
        if (e) setError('No pudimos leer las noches. Revisá la conexión y recargá.')
        else setEventos(data as EventoPublico[])
      })
  }, [])

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <h1 className="text-3xl font-bold">¡Hola, {primerNombre}!</h1>
          <p className="mt-1 text-profundo/70">Elegí la noche que vas a preparar o conducir.</p>
        </div>
        <Link to="/admin/noche/nueva" className="ml-auto">
          <BotonPrincipal>+ Nueva noche</BotonPrincipal>
        </Link>
      </div>

      {error && <Mensaje>{error}</Mensaje>}
      {eventos?.length === 0 && <p className="text-profundo/70">Todavía no hay noches. Creá la primera.</p>}

      {duplicando && (
        <Duplicar
          evento={duplicando}
          onCancelar={() => setDuplicando(null)}
          onListo={(id) => navegar(`/admin/noche/${id}`)}
        />
      )}

      <ul className="grid gap-4 md:grid-cols-2">
        {eventos?.map((ev) => (
          <li key={ev.id} className="flex flex-col gap-3 rounded-carta bg-white p-5 shadow-md">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-xl font-bold">{ev.name}</h2>
                <p className="text-sm text-profundo/70">
                  {[formatearFecha(ev.date), ev.venue, ev.code, ev.settings.edicion].filter(Boolean).join(' · ')}
                </p>
              </div>
              <span className="rounded-full bg-crema px-3 py-1 text-xs font-bold">{ESTADOS[ev.status]}</span>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link to={`/admin/vivo/${ev.id}`} className="boton-principal inline-flex items-center px-5 py-2 text-base">
                Conducir en vivo
              </Link>
              <Link to={`/admin/noche/${ev.id}`}>
                <BotonSecundario>Armar</BotonSecundario>
              </Link>
              <Link to={`/admin/ensayo/${ev.id}`}>
                <BotonSecundario>Ensayo</BotonSecundario>
              </Link>
              <BotonSecundario onClick={() => setDuplicando(ev)}>Duplicar</BotonSecundario>
              <EnlaceCopiable etiqueta="Proyector" ruta={`/pantalla/${ev.code}`} />
              <EnlaceCopiable etiqueta="Celular" ruta={`/jugar/${ev.code}`} />
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}

/** Duplicar: misma estructura (bloques e ítems) con otro nombre, código y fecha. */
function Duplicar({ evento, onCancelar, onListo }: { evento: EventoPublico; onCancelar: () => void; onListo: (id: string) => void }) {
  const [nombre, setNombre] = useState(`${evento.name} (copia)`)
  const [codigo, setCodigo] = useState('')
  const [fecha, setFecha] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function enviar(e: FormEvent) {
    e.preventDefault()
    setEnviando(true)
    setError(null)
    try {
      onListo(await admin.duplicateEvent(evento.id, nombre, codigo || sugerirCodigo(nombre), fecha || null))
    } catch (err) {
      setError(err instanceof ErrorRpc ? err.message : 'No se pudo duplicar.')
      setEnviando(false)
    }
  }

  return (
    <form onSubmit={enviar} className="flex flex-col gap-3 rounded-carta border-2 border-azul bg-white p-5 shadow-md">
      <h2 className="text-lg font-bold">Duplicar «{evento.name}»</h2>
      <p className="text-sm text-profundo/70">Se copian los bloques y los ítems. Las mesas, respuestas y puntos no.</p>
      <div className="grid gap-3 md:grid-cols-3">
        <Etiqueta texto="Nombre">
          <input value={nombre} onChange={(e) => setNombre(e.target.value)} className={CAMPO} maxLength={120} required />
        </Etiqueta>
        <Etiqueta texto="Código" ayuda={`(si lo dejás vacío: ${sugerirCodigo(nombre)})`}>
          <input value={codigo} onChange={(e) => setCodigo(e.target.value.toUpperCase())} className={CAMPO} maxLength={12} />
        </Etiqueta>
        <Etiqueta texto="Fecha">
          <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className={CAMPO} />
        </Etiqueta>
      </div>
      {error && <Mensaje>{error}</Mensaje>}
      <div className="flex gap-2">
        <BotonPrincipal disabled={enviando}>{enviando ? 'Duplicando…' : 'Duplicar'}</BotonPrincipal>
        <BotonSecundario type="button" onClick={onCancelar}>
          Cancelar
        </BotonSecundario>
      </div>
    </form>
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
