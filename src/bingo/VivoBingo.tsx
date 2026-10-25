import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { formatearNumero } from '../dynamics/solucion'
import { ErrorRpc } from '../lib/rpc'
import { admin } from '../lib/rpcAdmin'
import { supabase } from '../lib/supabase'
import type { Live } from '../lib/tipos'
import { codigoCarton, FORMATO, type TipoBingo } from './formato'
import { bingoAdmin, type CancionSet, type Verificacion } from './rpc'

const mensajeDe = (e: unknown) => (e instanceof ErrorRpc ? e.message : 'Algo salió mal. Probá de nuevo.')

type Bolilla = { number: number; position: number; created_at: string; revelada_at: string | null }

/**
 * /admin/vivo/:id — el bingo en juego: «Sacar bolilla» (la elige la base), «Repetir», qué está sonando
 * (el conductor ve número y título enseguida; el público, al terminar el fragmento o con «Revelar ya»), lo
 * que salió y «Verificar cartón» (con «Dar puntos» opcional).
 */
type Props = {
  eventId: string
  live: Live
  desfaseMs: number
  /** Set y tipo del bloque (de la estructura de la noche: live.block no trae la configuración). */
  setId: string | undefined
  tipo: TipoBingo
  onRepetir: () => void
}

export function VivoBingo({ eventId, live, desfaseMs, setId, tipo, onRepetir }: Props) {
  const f = FORMATO[tipo]
  const [canciones, setCanciones] = useState<Map<number, CancionSet>>(new Map())
  const [bolillas, setBolillas] = useState<Bolilla[]>([])
  const [ocupado, setOcupado] = useState(false)
  const [falla, setFalla] = useState<string | null>(null)
  const [ahora, setAhora] = useState(() => Date.now())

  useEffect(() => {
    if (!setId) return
    bingoAdmin.set(setId).then(
      (d) => setCanciones(new Map(d.canciones.map((c) => [c.number, c]))),
      (e) => setFalla(mensajeDe(e)),
    )
  }, [setId])

  const blockId = live.block?.id
  const leer = useCallback(async () => {
    if (!blockId) return
    const { data } = await supabase.from('bingo_draws').select('number, position, created_at, revelada_at').eq('block_id', blockId).order('position')
    if (data) setBolillas(data as Bolilla[])
  }, [blockId])
  useEffect(() => {
    void leer()
  }, [leer, live.server_now])

  const ultima = bolillas.at(-1)
  const duracion = ultima ? (canciones.get(ultima.number)?.duracion ?? 15) : 0
  const restante = ultima ? duracion - (ahora + desfaseMs - Date.parse(ultima.created_at)) / 1000 : 0
  const sonando = restante > 0
  // Oculta para el público: sonando y sin «Revelar ya». Revelada, ya se puede sacar la siguiente.
  const oculta = sonando && !ultima?.revelada_at
  useEffect(() => {
    if (!sonando) return
    const id = window.setInterval(() => setAhora(Date.now()), 250)
    return () => window.clearInterval(id)
  }, [sonando])

  const enJuego = live.phase === 'block_intro'
  const terminado = bolillas.length >= f.pool

  const sacar = async () => {
    setOcupado(true)
    setFalla(null)
    try {
      await bingoAdmin.sacar(eventId)
      setAhora(Date.now())
      await leer()
    } catch (e) {
      setFalla(mensajeDe(e))
    } finally {
      setOcupado(false)
    }
  }

  const revelar = async () => {
    setFalla(null)
    try {
      await bingoAdmin.revelar(eventId)
      await leer()
    } catch (e) {
      setFalla(mensajeDe(e))
    }
  }

  const actual = ultima ? canciones.get(ultima.number) : undefined

  return (
    <section className="flex flex-col gap-3 rounded-carta border-4 border-celeste/60 bg-white p-4 shadow-md">
      <h2 className="text-lg font-bold">
        🎵 Bingo musical · {f.nombre}{' '}
        <span className="text-sm font-semibold text-profundo/60">
          · cartones {f.letra} · salieron {bolillas.length} de {f.pool}
        </span>
      </h2>
      {!setId && <p className="font-semibold text-naranja">Este bloque no tiene set de canciones. Elegilo en Armar.</p>}
      <button
        disabled={ocupado || oculta || !enJuego || terminado || !setId}
        onClick={() => void sacar()}
        className="min-h-toque w-full rounded-xl bg-naranja px-4 font-titulo text-xl font-semibold text-white shadow-sm disabled:opacity-50"
      >
        {oculta ? `Sonando… ${Math.ceil(restante)} s` : terminado ? 'Salieron todas las canciones' : '🎱 Sacar bolilla'}
      </button>
      {!enJuego && <p className="text-sm text-profundo/70">Para jugar, presentá el bloque del bingo.</p>}
      {actual && ultima && (
        <div className="flex items-center gap-3 rounded-xl border-2 border-dashed border-naranja bg-naranja/5 px-3 py-2">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-naranja font-titulo text-xl font-bold text-white">
            {ultima.number}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-extrabold uppercase tracking-wide text-naranja">{oculta ? 'Sonando (solo lo ves vos)' : sonando ? 'Sonando · revelada' : 'Última'}</p>
            <p className="truncate font-bold">
              {actual.titulo} <span className="font-semibold text-profundo/60">· {actual.artista}</span>
            </p>
          </div>
          {oculta && (
            <button onClick={() => void revelar()} className="min-h-toque rounded-xl bg-azul px-3 font-semibold text-white">
              👁 Revelar ya
            </button>
          )}
          <button onClick={onRepetir} className="min-h-toque rounded-xl border-2 border-profundo/15 px-3 font-semibold hover:bg-crema">
            ▶ Repetir
          </button>
        </div>
      )}
      {falla && <p className="rounded-xl bg-naranja/15 px-4 py-2 text-sm font-semibold">{falla}</p>}

      <Verificar eventId={eventId} tipo={tipo} live={live} />

      {bolillas.length > 0 && (
        <details>
          <summary className="cursor-pointer text-sm font-bold">Salieron ({bolillas.length})</summary>
          <ol className="mt-2 flex max-h-60 flex-col gap-0.5 overflow-y-auto text-sm">
            {[...bolillas].reverse().map((b) => {
              const c = canciones.get(b.number)
              return (
                <li key={b.number} className="flex gap-2 rounded px-2 py-0.5 odd:bg-crema">
                  <span className="w-8 font-titulo font-bold">{b.number}</span>
                  <span className="min-w-0 flex-1 truncate">
                    {c?.titulo} <span className="text-profundo/60">· {c?.artista}</span>
                  </span>
                </li>
              )
            })}
          </ol>
        </details>
      )}
    </section>
  )
}

/** Verificar un cartón por su número: qué canciones ya salieron y si la línea o el bingo son válidos. */
function Verificar({ eventId, tipo, live }: { eventId: string; tipo: TipoBingo; live: Live }) {
  const f = FORMATO[tipo]
  const [numero, setNumero] = useState('')
  const [res, setRes] = useState<Verificacion | null>(null)
  const [falla, setFalla] = useState<string | null>(null)

  const verificar = async (e: FormEvent) => {
    e.preventDefault()
    setFalla(null)
    setRes(null)
    try {
      setRes(await bingoAdmin.verificar(eventId, Number(numero)))
    } catch (err) {
      setFalla(mensajeDe(err))
    }
  }

  return (
    <div className="rounded-xl bg-crema p-3">
      <form onSubmit={verificar} className="flex flex-wrap items-center gap-2">
        <span className="font-bold">Verificar cartón</span>
        <span className="font-titulo text-lg font-bold">{f.letra}-</span>
        <input
          value={numero}
          onChange={(e) => setNumero(e.target.value.replace(/\D/g, '').slice(0, 3))}
          inputMode="numeric"
          placeholder="007"
          className="w-20 rounded-lg border-2 border-profundo/15 px-2 py-1.5 font-titulo text-lg"
        />
        <button disabled={!numero} className="min-h-[40px] rounded-lg bg-azul px-3 font-semibold text-white disabled:opacity-40">
          Verificar
        </button>
      </form>
      {falla && <p className="mt-2 text-sm font-semibold text-naranja">{falla}</p>}
      {res && (
        <div className="mt-3">
          <p className={`mb-2 font-titulo text-lg font-bold ${res.bingo ? 'text-green-700' : res.lineas > 0 ? 'text-azul' : 'text-profundo/70'}`}>
            {codigoCarton(res.tipo, res.numero)}:{' '}
            {res.bingo ? '✔ ¡BINGO válido!' : res.lineas > 0 ? `✔ Línea válida${res.lineas > 1 ? ` (${res.lineas} líneas)` : ''}` : '✘ Todavía no tiene línea'}
          </p>
          <div className="flex flex-col gap-1">
            {res.filas.map((fila, i) => {
              const completa = fila.every((c) => c.salio)
              return (
                <div key={i} className={`flex flex-wrap gap-1 rounded-lg p-1 ${completa ? 'bg-green-100' : ''}`}>
                  {fila.map((c) => (
                    <span
                      key={c.number}
                      title={`${c.titulo} · ${c.artista}`}
                      className={`max-w-[11rem] truncate rounded-md px-2 py-0.5 text-xs font-semibold ${c.salio ? 'bg-green-700 text-white' : 'bg-white text-profundo/50'}`}
                    >
                      {c.number} · {c.titulo}
                    </span>
                  ))}
                </div>
              )
            })}
          </div>
          {(res.bingo || res.lineas > 0) && <DarPuntos eventId={eventId} live={live} motivo={`Bingo: ${res.bingo ? 'bingo' : 'línea'} (${codigoCarton(res.tipo, res.numero)})`} sugerido={res.bingo ? 1000 : 500} />}
        </div>
      )}
    </div>
  )
}

/** Opcional (si se juega por mesa): carga un punto manual a la mesa ganadora. */
function DarPuntos({ eventId, live, motivo, sugerido }: { eventId: string; live: Live; motivo: string; sugerido: number }) {
  const [mesa, setMesa] = useState('')
  const [puntos, setPuntos] = useState(String(sugerido))
  const [listo, setListo] = useState<string | null>(null)
  const [falla, setFalla] = useState<string | null>(null)
  if (live.teams.length === 0) return null
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        setFalla(null)
        admin.manualPoints(eventId, mesa, Number(puntos), motivo).then(
          () => setListo(`Listo: +${formatearNumero(Number(puntos))} para ${live.teams.find((t) => t.id === mesa)?.name}.`),
          (err) => setFalla(mensajeDe(err)),
        )
      }}
      className="mt-3 flex flex-wrap items-center gap-2 border-t border-profundo/10 pt-2 text-sm"
    >
      <span className="font-semibold">Dar puntos (opcional):</span>
      <select value={mesa} onChange={(e) => setMesa(e.target.value)} required className="rounded-lg border-2 border-profundo/15 px-2 py-1">
        <option value="">— mesa —</option>
        {live.teams.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name}
          </option>
        ))}
      </select>
      <input value={puntos} onChange={(e) => setPuntos(e.target.value.replace(/\D/g, ''))} inputMode="numeric" className="w-20 rounded-lg border-2 border-profundo/15 px-2 py-1" />
      <button disabled={!mesa || !puntos || Boolean(listo)} className="rounded-lg bg-naranja px-3 py-1 font-semibold text-white disabled:opacity-40">
        Sumar
      </button>
      {listo && <span className="font-semibold text-green-700">{listo}</span>}
      {falla && <span className="font-semibold text-naranja">{falla}</span>}
    </form>
  )
}
