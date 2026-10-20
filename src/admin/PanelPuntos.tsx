import { useState, type FormEvent } from 'react'
import { formatearNumero } from '../dynamics/solucion'
import { ErrorRpc } from '../lib/rpc'
import { admin } from '../lib/rpcAdmin'
import type { Live } from '../lib/tipos'
import { useHistorialAdmin } from './useHistorialAdmin'

type Props = { live: Live; eventId: string }

/** Derecha del panel: ranking, puntos manuales e historial de movimientos con Anular / Restaurar. */
export function PanelPuntos({ live, eventId }: Props) {
  const { movimientos, recargar } = useHistorialAdmin(eventId, `${live.updated_at}|${live.ranking.map((r) => r.total).join()}`)

  return (
    <div className="flex flex-col gap-4">
      <section>
        <h3 className="mb-2 font-bold">Ranking</h3>
        {live.ranking.length === 0 ? (
          <p className="text-sm text-profundo/60">Sin mesas todavía.</p>
        ) : (
          <ol className="flex flex-col gap-0.5 text-sm">
            {live.ranking.map((r) => (
              <li key={r.team_id} className={`flex gap-2 rounded-lg px-2 py-1 ${r.position === 1 ? 'bg-amarillo font-bold' : 'odd:bg-crema'}`}>
                <span className="w-5 text-profundo/60">{r.position}</span>
                <span className="min-w-0 flex-1 truncate">{r.name}</span>
                <span className="font-semibold tabular-nums">{formatearNumero(r.total)}</span>
              </li>
            ))}
          </ol>
        )}
      </section>

      <PuntosManuales live={live} eventId={eventId} onListo={recargar} />

      <section>
        <h3 className="mb-2 font-bold">Historial</h3>
        {movimientos.length === 0 ? (
          <p className="text-sm text-profundo/60">Todavía no hay puntos.</p>
        ) : (
          <ul className="flex max-h-80 flex-col gap-1 overflow-y-auto pr-1 text-sm">
            {movimientos.map((m) => (
              <MovimientoFila key={m.id} m={m} onCambio={recargar} />
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

function PuntosManuales({ live, eventId, onListo }: Props & { onListo: () => void }) {
  const [mesa, setMesa] = useState('')
  const [puntos, setPuntos] = useState('')
  const [motivo, setMotivo] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [mensaje, setMensaje] = useState<{ ok: boolean; texto: string } | null>(null)

  async function enviar(e: FormEvent) {
    e.preventDefault()
    const n = Number(puntos)
    if (!mesa || !Number.isInteger(n) || n === 0) {
      setMensaje({ ok: false, texto: 'Elegí una mesa y escribí los puntos (un entero; negativo para restar).' })
      return
    }
    setEnviando(true)
    setMensaje(null)
    try {
      await admin.manualPoints(eventId, mesa, n, motivo)
      const nombre = live.teams.find((t) => t.id === mesa)?.name ?? 'la mesa'
      setMensaje({ ok: true, texto: `${n > 0 ? '+' : ''}${formatearNumero(n)} para ${nombre}.` })
      setPuntos('')
      setMotivo('')
      onListo()
    } catch (err) {
      setMensaje({ ok: false, texto: err instanceof ErrorRpc ? err.message : 'Algo salió mal. Probá de nuevo.' })
    } finally {
      setEnviando(false)
    }
  }

  const campo = 'min-h-toque w-full rounded-xl border-2 border-profundo/15 bg-white px-3 focus:border-azul focus:outline-none'
  return (
    <form onSubmit={enviar} className="flex flex-col gap-2 rounded-xl bg-crema p-3">
      <h3 className="font-bold">Puntos manuales</h3>
      <select value={mesa} onChange={(e) => setMesa(e.target.value)} className={campo} aria-label="Mesa">
        <option value="">Elegí la mesa…</option>
        {live.teams.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name}
          </option>
        ))}
      </select>
      <input
        value={puntos}
        onChange={(e) => setPuntos(e.target.value.replace(/[^0-9-]/g, ''))}
        inputMode="numeric"
        placeholder="Puntos (ej.: 200 o -100)"
        aria-label="Puntos (negativo para restar)"
        className={campo}
      />
      <input
        value={motivo}
        onChange={(e) => setMotivo(e.target.value)}
        maxLength={200}
        placeholder="Motivo (ej.: mejor disfraz)"
        aria-label="Motivo"
        className={campo}
      />
      <button disabled={enviando} className="min-h-toque rounded-xl bg-azul font-semibold text-white disabled:opacity-50">
        {enviando ? 'Guardando…' : 'Aplicar'}
      </button>
      {mensaje && <p className={`text-sm font-semibold ${mensaje.ok ? 'text-green-700' : 'text-naranja'}`}>{mensaje.texto}</p>}
    </form>
  )
}

function MovimientoFila({ m, onCambio }: { m: ReturnType<typeof useHistorialAdmin>['movimientos'][number]; onCambio: () => void }) {
  const [ocupado, setOcupado] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function alternar() {
    setOcupado(true)
    setError(null)
    try {
      await (m.voided ? admin.unvoidEntry(m.id) : admin.voidEntry(m.id))
      onCambio()
    } catch (e) {
      setError(e instanceof ErrorRpc ? e.message : 'No se pudo.')
    } finally {
      setOcupado(false)
    }
  }

  return (
    <li className={`flex items-center gap-2 rounded-lg px-2 py-1 odd:bg-crema ${m.voided ? 'text-profundo/40 line-through' : ''}`}>
      <span className="min-w-0 flex-1">
        <span className="font-semibold">{m.teams?.name ?? '?'}</span>{' '}
        <span className="text-profundo/60">
          · {m.reason}
          {m.origin === 'manual' && ' (manual)'}
        </span>
        {error && <span className="block text-xs text-naranja no-underline">{error}</span>}
      </span>
      <span className={`font-semibold tabular-nums ${m.points < 0 ? 'text-naranja' : ''}`}>
        {m.points > 0 ? '+' : ''}
        {formatearNumero(m.points)}
      </span>
      <button
        onClick={() => void alternar()}
        disabled={ocupado}
        className="rounded-lg border border-profundo/20 px-2 py-0.5 text-xs font-semibold no-underline hover:bg-white disabled:opacity-40"
      >
        {m.voided ? 'Restaurar' : 'Anular'}
      </button>
    </li>
  )
}
