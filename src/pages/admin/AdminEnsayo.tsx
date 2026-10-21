import { useRef, useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { revisarVideo, type ResultadoVideo } from '../../admin/revisarVideo'
import { useEstructura } from '../../admin/useEstructura'
import { BotonPrincipal, BotonSecundario, CAMPO, Etiqueta, Mensaje, Tarjeta } from '../../admin/ui'
import { ErrorRpc } from '../../lib/rpc'
import { admin } from '../../lib/rpcAdmin'

type Video = { id: string; bloque: string; numero: number; youtubeId: string; inicio: number; duracion: number; nombre: string }

/** /admin/ensayo/:eventId — chequeo de los videos de la noche y reinicio para ensayos. */
export default function AdminEnsayo() {
  const { eventId = '' } = useParams()
  const { evento, bloques, error } = useEstructura(eventId)
  const videos: Video[] = bloques.flatMap((b) =>
    b.items
      .filter((i) => i.tipo === 'pista_audio' || i.tipo === 'clip_video')
      .map((i, n) => ({
        id: i.id,
        bloque: b.title,
        numero: n + 1,
        youtubeId: String(i.content.youtube_id ?? ''),
        inicio: 0, // las canciones arrancan siempre desde 0:00
        duracion: Number(i.content.duracion ?? 20),
        nombre: [i.solution?.anio, i.solution?.titulo, i.solution?.artista].filter(Boolean).join(' · '),
      })),
  )

  if (error) return <Mensaje>{error}</Mensaje>
  if (!evento) return <p className="text-profundo/70">Cargando la noche…</p>

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <Link to="/admin" className="text-sm font-semibold text-azul">
          ← Noches
        </Link>
        <h1 className="text-3xl font-bold">Ensayo · {evento.name}</h1>
      </div>
      <Videos videos={videos} />
      <Reinicio eventId={evento.id} codigo={evento.code} estado={evento.status} />
    </div>
  )
}

function Videos({ videos }: { videos: Video[] }) {
  const contenedor = useRef<HTMLDivElement>(null)
  const [resultados, setResultados] = useState<Record<string, ResultadoVideo | 'revisando'>>({})
  const [revisando, setRevisando] = useState(false)

  async function revisar(lista: Video[]) {
    if (!contenedor.current) return
    setRevisando(true)
    for (const v of lista) {
      setResultados((r) => ({ ...r, [v.id]: 'revisando' }))
      let resultado: ResultadoVideo
      try {
        resultado = await revisarVideo(contenedor.current, v.youtubeId, v.inicio, v.duracion)
      } catch {
        resultado = { estado: 'error', mensaje: 'No se pudo cargar YouTube. Revisá la conexión.' }
      }
      setResultados((r) => ({ ...r, [v.id]: resultado }))
    }
    contenedor.current?.replaceChildren()
    setRevisando(false)
  }

  const malos = videos.filter((v) => {
    const r = resultados[v.id]
    return r && r !== 'revisando' && r.estado === 'error'
  }).length

  return (
    <Tarjeta
      titulo={`Videos de la noche · ${videos.length}`}
      acciones={
        <BotonPrincipal disabled={revisando || videos.length === 0} onClick={() => void revisar(videos)}>
          {revisando ? 'Revisando…' : 'Revisar todos'}
        </BotonPrincipal>
      }
    >
      {videos.length === 0 ? (
        <p className="text-profundo/70">Esta noche no tiene canciones ni clips.</p>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
          <ol className="flex flex-col gap-1 text-sm">
            {videos.map((v) => {
              const r = resultados[v.id]
              const color = !r || r === 'revisando' ? '' : r.estado === 'ok' ? 'border-green-600 bg-green-50' : r.estado === 'error' ? 'border-red-600 bg-red-50' : 'border-naranja bg-naranja/10'
              return (
                <li key={v.id} className={`flex flex-wrap items-center gap-2 rounded-lg border-l-4 px-3 py-2 ${color || 'border-profundo/15'}`}>
                  <span className="text-profundo/50">
                    {v.bloque} #{v.numero}
                  </span>
                  <span className="min-w-0 flex-1 font-semibold">{v.nombre || v.youtubeId}</span>
                  <span className="w-full text-xs sm:w-auto">
                    {r === 'revisando' ? (
                      'Revisando…'
                    ) : r ? (
                      <span className={r.estado === 'ok' ? 'font-bold text-green-700' : r.estado === 'error' ? 'font-bold text-red-700' : 'font-bold text-naranja'}>
                        {r.estado === 'ok' ? '✔ ' : r.estado === 'error' ? '✘ ' : '⚠ '}
                        {r.mensaje}
                      </span>
                    ) : (
                      <span className="text-profundo/40">sin revisar</span>
                    )}
                  </span>
                  <BotonSecundario className="min-h-0 py-1 text-xs" disabled={revisando} onClick={() => void revisar([v])}>
                    Revisar
                  </BotonSecundario>
                </li>
              )
            })}
          </ol>
          <div className="flex flex-col gap-2">
            {/* Player de prueba (silenciado). Se ve a propósito: es el panel, no el proyector. */}
            <div ref={contenedor} className="aspect-video w-full overflow-hidden rounded-xl bg-profundo/10" />
            <p className="text-xs text-profundo/60">
              Se prueba cada video silenciado, desde el principio.
              {malos > 0 && <span className="block font-bold text-red-700">Hay {malos} que no van a sonar: reemplazalos en el catálogo.</span>}
            </p>
          </div>
        </div>
      )}
    </Tarjeta>
  )
}

function Reinicio({ eventId, codigo, estado }: { eventId: string; codigo: string; estado: string }) {
  const [texto, setTexto] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [mensaje, setMensaje] = useState<{ ok: boolean; texto: string } | null>(null)

  async function reiniciar(e: FormEvent) {
    e.preventDefault()
    setEnviando(true)
    setMensaje(null)
    try {
      await admin.resetEvent(eventId, texto)
      setMensaje({ ok: true, texto: 'Listo: la noche quedó en cero, en la portada y lista para jugar.' })
      setTexto('')
    } catch (err) {
      setMensaje({ ok: false, texto: err instanceof ErrorRpc ? err.message : 'No se pudo reiniciar.' })
    } finally {
      setEnviando(false)
    }
  }

  return (
    <Tarjeta titulo="Reiniciar noche">
      <form onSubmit={reiniciar} className="flex flex-col gap-3">
        <p className="text-sm text-profundo/70">
          Borra <strong>todas las mesas, respuestas y puntos</strong> de esta noche y la vuelve a la portada. Los bloques y los ítems
          quedan como están. Los celulares que estaban jugando vuelven a la pantalla de registro.
          {estado === 'terminado' && (
            <strong className="block text-red-700">
              Ojo: esta noche ya se jugó. Se pierde su historial (podio y puntos). Si querés guardarlo, mejor duplicala desde Noches.
            </strong>
          )}
          {estado === 'en_vivo' && (
            <strong className="block text-red-700">Ojo: esta noche está en vivo. Si se está jugando, se pierde todo lo jugado hasta ahora.</strong>
          )}
        </p>
        <Etiqueta texto={`Para confirmar, escribí el código de la noche: ${codigo}`}>
          <input value={texto} onChange={(e) => setTexto(e.target.value.toUpperCase())} className={`${CAMPO} max-w-xs font-titulo tracking-widest`} />
        </Etiqueta>
        {mensaje && <Mensaje tipo={mensaje.ok ? 'ok' : 'error'}>{mensaje.texto}</Mensaje>}
        <button
          disabled={enviando || texto.trim() !== codigo}
          className="min-h-toque self-start rounded-xl bg-red-700 px-4 font-titulo font-semibold text-white disabled:opacity-40"
        >
          {enviando ? 'Reiniciando…' : 'Reiniciar noche'}
        </button>
      </form>
    </Tarjeta>
  )
}
