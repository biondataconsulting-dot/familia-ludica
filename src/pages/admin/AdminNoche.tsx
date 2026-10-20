import { useMemo, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useCatalogo, resumenItem, type ItemCatalogo } from '../../admin/useCatalogo'
import { useEstructura, type BloqueAdmin } from '../../admin/useEstructura'
import { BotonPrincipal, BotonSecundario, CAMPO, Etiqueta, Mensaje, Tarjeta } from '../../admin/ui'
import { sugerirCodigo } from '../../content/codigo'
import { NOMBRE_TIPO, TIPOS_POR_DINAMICA } from '../../content/validarItem'
import { metaDe } from '../../dynamics/registro'
import { ErrorRpc } from '../../lib/rpc'
import { admin } from '../../lib/rpcAdmin'
import type { EventoPublico } from '../../lib/tipos'

const DINAMICAS = ['trivia', 'dos_verdades', 'aproximaciones', 'hipster', 'cine'] as const
const mensajeDe = (e: unknown) => (e instanceof ErrorRpc ? e.message : 'Algo salió mal. Probá de nuevo.')

/** /admin/noche/:id — datos de la noche, bloques e ítems de cada bloque. "nueva" crea una. */
export default function AdminNoche() {
  const { eventId = 'nueva' } = useParams()
  if (eventId === 'nueva') return <FormNoche evento={null} />
  return <Noche eventId={eventId} />
}

function Noche({ eventId }: { eventId: string }) {
  const { evento, bloques, error, recargar } = useEstructura(eventId)
  if (error) return <Mensaje>{error}</Mensaje>
  if (!evento) return <p className="text-profundo/70">Cargando la noche…</p>
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-2">
        <Link to="/admin" className="text-sm font-semibold text-azul">
          ← Noches
        </Link>
        <Link to={`/admin/vivo/${evento.id}`} className="ml-auto">
          <BotonPrincipal>Abrir en vivo</BotonPrincipal>
        </Link>
      </div>
      <FormNoche evento={evento} onGuardado={recargar} />
      <Bloques evento={evento} bloques={bloques} onCambio={recargar} />
      <BorrarNoche evento={evento} />
    </div>
  )
}

/** Borrar una noche mal cargada o de prueba (pide escribir el código para confirmar). */
function BorrarNoche({ evento }: { evento: EventoPublico }) {
  const navegar = useNavigate()
  const [abierto, setAbierto] = useState(false)
  const [texto, setTexto] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const jugada = evento.status === 'en_vivo' || evento.status === 'terminado'

  async function borrar(e: FormEvent) {
    e.preventDefault()
    setEnviando(true)
    setError(null)
    try {
      await admin.deleteEvent(evento.id, texto)
      navegar('/admin', { replace: true })
    } catch (err) {
      setError(mensajeDe(err))
      setEnviando(false)
    }
  }

  if (!abierto) {
    return (
      <button onClick={() => setAbierto(true)} className="self-start text-sm font-semibold text-red-700 underline">
        Borrar esta noche…
      </button>
    )
  }
  return (
    <Tarjeta titulo="Borrar noche">
      <form onSubmit={borrar} className="flex flex-col gap-3">
        <p className="text-sm text-profundo/70">
          Borra la noche <strong>para siempre</strong>: sus bloques, mesas, respuestas y puntos. Los ítems del catálogo no se tocan.
          {jugada && (
            <strong className="block text-red-700">
              {evento.status === 'en_vivo'
                ? 'Ojo: esta noche está en vivo. Si hay un proyector o celulares conectados, van a ver "No encontramos esta noche".'
                : 'Ojo: esta noche ya se jugó. Se pierde su historial (podio y puntos).'}
            </strong>
          )}
        </p>
        <Etiqueta texto={`Para confirmar, escribí el código de la noche: ${evento.code}`}>
          <input value={texto} onChange={(e) => setTexto(e.target.value.toUpperCase())} className={`${CAMPO} max-w-xs font-titulo tracking-widest`} />
        </Etiqueta>
        {error && <Mensaje>{error}</Mensaje>}
        <div className="flex flex-wrap gap-2">
          <button
            disabled={enviando || texto.trim() !== evento.code}
            className="min-h-toque rounded-xl bg-red-700 px-4 font-titulo font-semibold text-white disabled:opacity-40"
          >
            {enviando ? 'Borrando…' : 'Borrar noche'}
          </button>
          <BotonSecundario type="button" onClick={() => setAbierto(false)}>
            Cancelar
          </BotonSecundario>
        </div>
      </form>
    </Tarjeta>
  )
}

// ---------------------------------------------------------------- datos de la noche

function FormNoche({ evento, onGuardado }: { evento: EventoPublico | null; onGuardado?: () => void }) {
  const navegar = useNavigate()
  const [nombre, setNombre] = useState(evento?.name ?? '')
  const [fecha, setFecha] = useState(evento?.date ?? '')
  const [lugar, setLugar] = useState(evento?.venue ?? '')
  const [codigo, setCodigo] = useState(evento?.code ?? '')
  const [sello, setSello] = useState(evento?.settings.edicion ?? '')
  const [estado, setEstado] = useState<'borrador' | 'listo'>(evento?.status === 'borrador' ? 'borrador' : 'listo')
  const [codigoTocado, setCodigoTocado] = useState(Boolean(evento))
  const [enviando, setEnviando] = useState(false)
  const [mensaje, setMensaje] = useState<{ ok: boolean; texto: string } | null>(null)
  const enVivo = evento?.status === 'en_vivo' || evento?.status === 'terminado'

  async function guardar(e: FormEvent) {
    e.preventDefault()
    setEnviando(true)
    setMensaje(null)
    try {
      const id = await admin.saveEvent({
        id: evento?.id,
        name: nombre,
        date: fecha || null,
        venue: lugar,
        code: codigo || sugerirCodigo(nombre),
        edicion: sello,
        status: enVivo ? undefined : estado,
      })
      if (!evento) navegar(`/admin/noche/${id}`, { replace: true })
      else {
        setMensaje({ ok: true, texto: 'Guardado.' })
        onGuardado?.()
      }
    } catch (err) {
      setMensaje({ ok: false, texto: mensajeDe(err) })
    } finally {
      setEnviando(false)
    }
  }

  return (
    <Tarjeta titulo={evento ? 'Datos de la noche' : 'Nueva noche'}>
      <form onSubmit={guardar} className="flex flex-col gap-3">
        <div className="grid gap-3 md:grid-cols-2">
          <Etiqueta texto="Nombre" ayuda="(lo que se ve grande en la portada)">
            <input
              value={nombre}
              onChange={(e) => {
                setNombre(e.target.value)
                if (!codigoTocado) setCodigo(sugerirCodigo(e.target.value))
              }}
              maxLength={120}
              required
              placeholder="Noche de Halloween"
              className={CAMPO}
            />
          </Etiqueta>
          <Etiqueta texto="Sello" ayuda="(arriba del nombre; opcional)">
            <input value={sello} onChange={(e) => setSello(e.target.value)} maxLength={40} placeholder="Edición especial" className={CAMPO} />
          </Etiqueta>
          <Etiqueta texto="Fecha">
            <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className={CAMPO} />
          </Etiqueta>
          <Etiqueta texto="Lugar">
            <input value={lugar} onChange={(e) => setLugar(e.target.value)} maxLength={120} placeholder="Naudir" className={CAMPO} />
          </Etiqueta>
          <Etiqueta texto="Código" ayuda="(va en el QR y en el enlace; 3 a 12 letras o números)">
            <input
              value={codigo}
              onChange={(e) => {
                setCodigoTocado(true)
                setCodigo(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))
              }}
              maxLength={12}
              disabled={evento?.status === 'en_vivo'}
              className={`${CAMPO} font-titulo tracking-widest`}
            />
          </Etiqueta>
          <Etiqueta texto="Estado">
            {enVivo ? (
              <p className="min-h-toque py-3 font-semibold">{evento?.status === 'en_vivo' ? 'En vivo' : 'Terminada'}</p>
            ) : (
              <select value={estado} onChange={(e) => setEstado(e.target.value as 'borrador' | 'listo')} className={CAMPO}>
                <option value="borrador">Borrador (todavía armándose)</option>
                <option value="listo">Lista para jugar</option>
              </select>
            )}
          </Etiqueta>
        </div>
        {mensaje && <Mensaje tipo={mensaje.ok ? 'ok' : 'error'}>{mensaje.texto}</Mensaje>}
        <div className="flex flex-wrap items-center gap-3">
          <BotonPrincipal disabled={enviando}>{enviando ? 'Guardando…' : evento ? 'Guardar' : 'Crear la noche'}</BotonPrincipal>
          {evento && (
            <p className="text-sm text-profundo/60">
              Proyector: <span className="font-semibold">/pantalla/{evento.code}</span> · Celular:{' '}
              <span className="font-semibold">/jugar/{evento.code}</span>
            </p>
          )}
        </div>
      </form>
    </Tarjeta>
  )
}

// ---------------------------------------------------------------- bloques

function Bloques({ evento, bloques, onCambio }: { evento: EventoPublico; bloques: BloqueAdmin[]; onCambio: () => void }) {
  const [agregando, setAgregando] = useState(false)
  const { items: catalogo, recargar: recargarCatalogo } = useCatalogo()
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <h2 className="text-2xl font-bold">Bloques</h2>
        <BotonSecundario className="ml-auto" onClick={() => setAgregando(true)}>
          + Agregar bloque
        </BotonSecundario>
      </div>
      {bloques.length === 0 && !agregando && <p className="text-profundo/70">Esta noche todavía no tiene bloques.</p>}
      {bloques.map((b, i) => (
        <EditorBloque
          key={b.id}
          eventId={evento.id}
          bloque={b}
          primero={i === 0}
          ultimo={i === bloques.length - 1}
          catalogo={catalogo}
          onCambio={() => {
            onCambio()
            void recargarCatalogo()
          }}
        />
      ))}
      {agregando && (
        <EditorBloque
          eventId={evento.id}
          bloque={null}
          primero
          ultimo
          catalogo={catalogo}
          onCambio={() => {
            setAgregando(false)
            onCambio()
          }}
          onCancelar={() => setAgregando(false)}
        />
      )}
    </div>
  )
}

function EditorBloque(props: {
  eventId: string
  bloque: BloqueAdmin | null
  primero: boolean
  ultimo: boolean
  catalogo: ItemCatalogo[] | null
  onCambio: () => void
  onCancelar?: () => void
}) {
  const { eventId, bloque, primero, ultimo, catalogo, onCambio, onCancelar } = props
  const [dinamica, setDinamica] = useState(bloque?.dynamic ?? 'trivia')
  const [titulo, setTitulo] = useState(bloque?.title ?? metaDe('trivia').nombre)
  const [mult, setMult] = useState(String(bloque?.multiplier ?? 1))
  const [practica, setPractica] = useState(bloque?.is_practice ?? false)
  const [tiempo, setTiempo] = useState(bloque?.config.timer_seconds != null ? String(bloque.config.timer_seconds) : '30')
  const [ocupado, setOcupado] = useState(false)
  const [mensaje, setMensaje] = useState<{ ok: boolean; texto: string } | null>(null)
  const [eligiendo, setEligiendo] = useState(false)

  const ejecutar = async (accion: () => Promise<unknown>, ok?: string) => {
    setOcupado(true)
    setMensaje(null)
    try {
      await accion()
      if (ok) setMensaje({ ok: true, texto: ok })
      onCambio()
    } catch (e) {
      setMensaje({ ok: false, texto: mensajeDe(e) })
    } finally {
      setOcupado(false)
    }
  }

  const guardar = (e: FormEvent) => {
    e.preventDefault()
    void ejecutar(
      () =>
        admin.saveBlock({
          id: bloque?.id,
          event_id: eventId,
          dynamic: dinamica,
          title: titulo,
          multiplier: Number(mult.replace(',', '.')),
          is_practice: practica,
          timer_seconds: tiempo ? Number(tiempo) : null,
        }),
      bloque ? 'Bloque guardado.' : undefined,
    )
  }

  const ids = bloque?.items.map((i) => i.catalog_item_id) ?? []
  const ponerItems = (nuevos: string[]) => void ejecutar(() => admin.setBlockItems(bloque!.id, nuevos))
  const mover = (i: number, d: -1 | 1) => {
    const n = [...ids]
    const [x] = n.splice(i, 1)
    n.splice(i + d, 0, x!)
    ponerItems(n)
  }

  return (
    <Tarjeta
      titulo={bloque ? `${bloque.position}. ${bloque.title}` : 'Bloque nuevo'}
      acciones={
        bloque && (
          <>
            <BotonSecundario disabled={ocupado || primero} onClick={() => void ejecutar(() => admin.moveBlock(bloque.id, -1))} aria-label="Subir bloque">
              ↑
            </BotonSecundario>
            <BotonSecundario disabled={ocupado || ultimo} onClick={() => void ejecutar(() => admin.moveBlock(bloque.id, 1))} aria-label="Bajar bloque">
              ↓
            </BotonSecundario>
            <BotonSecundario
              disabled={ocupado}
              onClick={() => {
                if (window.confirm(`¿Borrar el bloque «${bloque.title}»? Los ítems siguen en el catálogo.`)) void ejecutar(() => admin.deleteBlock(bloque.id))
              }}
            >
              Borrar
            </BotonSecundario>
          </>
        )
      }
    >
      <form onSubmit={guardar} className="grid items-end gap-3 md:grid-cols-[1fr_1.4fr_0.6fr_0.7fr_auto_auto]">
        <Etiqueta texto="Dinámica">
          <select
            value={dinamica}
            onChange={(e) => {
              if (!bloque && titulo === metaDe(dinamica).nombre) setTitulo(metaDe(e.target.value).nombre)
              setDinamica(e.target.value)
            }}
            className={CAMPO}
          >
            {DINAMICAS.map((d) => (
              <option key={d} value={d}>
                {metaDe(d).nombre}
              </option>
            ))}
          </select>
        </Etiqueta>
        <Etiqueta texto="Título" ayuda="(en pantalla)">
          <input value={titulo} onChange={(e) => setTitulo(e.target.value)} maxLength={80} required className={CAMPO} />
        </Etiqueta>
        <Etiqueta texto="Puntos ×">
          <input value={mult} onChange={(e) => setMult(e.target.value)} inputMode="decimal" className={CAMPO} />
        </Etiqueta>
        <Etiqueta texto="Tiempo (s)" ayuda="(vacío: sin reloj)">
          <input value={tiempo} onChange={(e) => setTiempo(e.target.value.replace(/\D/g, ''))} inputMode="numeric" className={CAMPO} />
        </Etiqueta>
        <label className="flex min-h-toque items-center gap-2 font-semibold">
          <input type="checkbox" checked={practica} onChange={(e) => setPractica(e.target.checked)} className="h-5 w-5" />
          Práctica
        </label>
        <div className="flex gap-2">
          <BotonPrincipal disabled={ocupado}>{bloque ? 'Guardar' : 'Crear'}</BotonPrincipal>
          {onCancelar && (
            <BotonSecundario type="button" onClick={onCancelar}>
              Cancelar
            </BotonSecundario>
          )}
        </div>
      </form>
      {mensaje && (
        <div className="mt-3">
          <Mensaje tipo={mensaje.ok ? 'ok' : 'error'}>{mensaje.texto}</Mensaje>
        </div>
      )}

      {bloque && (
        <div className="mt-4 border-t border-profundo/10 pt-3">
          <div className="mb-2 flex items-center gap-2">
            <h3 className="font-bold">Ítems · {bloque.items.length}</h3>
            <BotonSecundario className="ml-auto" disabled={ocupado} onClick={() => setEligiendo((x) => !x)}>
              {eligiendo ? 'Cerrar catálogo' : '+ Agregar del catálogo'}
            </BotonSecundario>
          </div>
          {bloque.items.length === 0 ? (
            <p className="text-sm text-profundo/60">Sin ítems todavía.</p>
          ) : (
            <ol className="flex flex-col gap-1">
              {bloque.items.map((it, i) => (
                <li key={it.id} className="flex items-center gap-2 rounded-lg px-2 py-1 text-sm odd:bg-crema">
                  <span className="w-6 text-profundo/50">{i + 1}</span>
                  <span className="min-w-0 flex-1 truncate">{resumenItem(it.tipo, it.content, it.solution ?? {})}</span>
                  <button disabled={ocupado || i === 0} onClick={() => mover(i, -1)} className="px-2 disabled:opacity-30" aria-label="Subir">
                    ↑
                  </button>
                  <button disabled={ocupado || i === ids.length - 1} onClick={() => mover(i, 1)} className="px-2 disabled:opacity-30" aria-label="Bajar">
                    ↓
                  </button>
                  <button disabled={ocupado} onClick={() => ponerItems(ids.filter((x) => x !== it.catalog_item_id))} className="px-2 text-naranja" aria-label="Sacar del bloque">
                    ✕
                  </button>
                </li>
              ))}
            </ol>
          )}
          {eligiendo && (
            <ElegirItems
              dinamica={bloque.dynamic}
              catalogo={catalogo}
              yaEstan={ids}
              onAgregar={(nuevos) => {
                ponerItems([...ids, ...nuevos])
                setEligiendo(false)
              }}
            />
          )}
        </div>
      )}
    </Tarjeta>
  )
}

/** Catálogo filtrado por los tipos que acepta la dinámica, por etiqueta y por texto. */
function ElegirItems(props: { dinamica: string; catalogo: ItemCatalogo[] | null; yaEstan: string[]; onAgregar: (ids: string[]) => void }) {
  const { dinamica, catalogo, yaEstan, onAgregar } = props
  const [etiqueta, setEtiqueta] = useState('')
  const [texto, setTexto] = useState('')
  const [elegidos, setElegidos] = useState<string[]>([])
  const tipos = useMemo(() => TIPOS_POR_DINAMICA[dinamica] ?? [], [dinamica])
  const compatibles = useMemo(() => (catalogo ?? []).filter((i) => tipos.includes(i.type) && !yaEstan.includes(i.id)), [catalogo, tipos, yaEstan])
  const etiquetas = useMemo(() => [...new Set(compatibles.flatMap((i) => i.tags))].sort(), [compatibles])
  const t = texto.trim().toLowerCase()
  const visibles = compatibles.filter(
    (i) => (!etiqueta || i.tags.includes(etiqueta)) && (!t || resumenItem(i.type, i.content, i.solution).toLowerCase().includes(t)),
  )
  const marcados = visibles.filter((v) => elegidos.includes(v.id)).map((v) => v.id)

  return (
    <div className="mt-3 rounded-xl border-2 border-azul/30 p-3">
      <p className="mb-2 text-sm text-profundo/70">
        Ítems de tipo {tipos.map((x) => NOMBRE_TIPO[x]).join(' o ')} que todavía no están en el bloque.
      </p>
      <div className="mb-2 flex flex-wrap gap-2">
        <select value={etiqueta} onChange={(e) => setEtiqueta(e.target.value)} className={`${CAMPO} w-auto`} aria-label="Etiqueta">
          <option value="">Todas las etiquetas</option>
          {etiquetas.map((e) => (
            <option key={e}>{e}</option>
          ))}
        </select>
        <input value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Buscar…" className={`${CAMPO} w-auto flex-1`} />
        <BotonPrincipal disabled={marcados.length === 0} onClick={() => onAgregar(marcados)}>
          Agregar {marcados.length || ''}
        </BotonPrincipal>
      </div>
      {catalogo === null ? (
        <p className="text-sm">Cargando el catálogo…</p>
      ) : visibles.length === 0 ? (
        <p className="text-sm text-profundo/60">
          No hay ítems para agregar. Cargalos en el <Link to="/admin/catalogo" className="font-semibold text-azul underline">catálogo</Link> o con el{' '}
          <Link to="/admin/importar" className="font-semibold text-azul underline">importador</Link>.
        </p>
      ) : (
        <ul className="flex max-h-72 flex-col gap-1 overflow-y-auto">
          {visibles.map((i) => (
            <li key={i.id}>
              <label className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1 text-sm hover:bg-crema">
                <input
                  type="checkbox"
                  checked={elegidos.includes(i.id)}
                  onChange={(e) => setElegidos((x) => (e.target.checked ? [...x, i.id] : x.filter((y) => y !== i.id)))}
                  className="h-4 w-4"
                />
                <span className="min-w-0 flex-1 truncate">{resumenItem(i.type, i.content, i.solution)}</span>
                {i.status !== 'aprobado' && <span className="text-xs font-bold text-naranja">{i.status}</span>}
                <span className="text-xs text-profundo/50">{i.tags.join(', ')}</span>
              </label>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
