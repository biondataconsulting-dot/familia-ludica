import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Mensaje, Tarjeta } from '../../admin/ui'
import { formatearNumero } from '../../dynamics/solucion'
import { formatearFecha } from '../../lib/fechas'
import { supabase } from '../../lib/supabase'
import type { EventoPublico } from '../../lib/tipos'

/** /admin/historial — noches terminadas. /admin/historial/:eventId — podio, ranking por bloque y detalle por mesa. */
export default function AdminHistorial() {
  const { eventId } = useParams()
  return eventId ? <Detalle eventId={eventId} /> : <Lista />
}

function Lista() {
  const [eventos, setEventos] = useState<EventoPublico[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    supabase
      .from('events')
      .select('id, name, date, venue, code, status, settings')
      .eq('status', 'terminado')
      .order('date', { ascending: false })
      .then(({ data, error: e }) => (e ? setError('No pudimos leer el historial.') : setEventos(data as EventoPublico[])))
  }, [])

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-3xl font-bold">Historial</h1>
      {error && <Mensaje>{error}</Mensaje>}
      {eventos?.length === 0 && <p className="text-profundo/70">Todavía no hay noches terminadas.</p>}
      <ul className="grid gap-3 md:grid-cols-2">
        {eventos?.map((ev) => (
          <li key={ev.id}>
            <Link to={`/admin/historial/${ev.id}`} className="block rounded-carta bg-white p-5 shadow-md hover:ring-2 hover:ring-azul">
              <p className="text-xl font-bold">{ev.name}</p>
              <p className="text-sm text-profundo/70">{[formatearFecha(ev.date), ev.venue, ev.code].filter(Boolean).join(' · ')}</p>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}

type Fila = { team_id: string; name: string; total: number; position: number }
type PorBloque = { block_id: string; team_id: string; total: number }
type Bloque = { id: string; title: string; position: number; is_practice: boolean }
type Movimiento = { team_id: string; points: number; reason: string; origin: string; voided: boolean }

function Detalle({ eventId }: { eventId: string }) {
  const [evento, setEvento] = useState<EventoPublico | null>(null)
  const [ranking, setRanking] = useState<Fila[]>([])
  const [bloques, setBloques] = useState<Bloque[]>([])
  const [porBloque, setPorBloque] = useState<PorBloque[]>([])
  const [movimientos, setMovimientos] = useState<Movimiento[]>([])
  const [abierta, setAbierta] = useState<string | null>(null)

  useEffect(() => {
    void Promise.all([
      supabase.from('events').select('id, name, date, venue, code, status, settings').eq('id', eventId).maybeSingle(),
      supabase.from('ranking').select('team_id, name, total, position').eq('event_id', eventId).order('position'),
      supabase.from('event_blocks').select('id, title, position, is_practice').eq('event_id', eventId).order('position'),
      supabase.from('ranking_by_block').select('block_id, team_id, total').eq('event_id', eventId),
      supabase.from('score_entries').select('team_id, points, reason, origin, voided').eq('event_id', eventId).order('created_at'),
    ]).then(([e, r, b, pb, m]) => {
      setEvento(e.data as EventoPublico | null)
      setRanking((r.data as Fila[]) ?? [])
      setBloques((b.data as Bloque[]) ?? [])
      setPorBloque((pb.data as PorBloque[]) ?? [])
      setMovimientos((m.data as Movimiento[]) ?? [])
    })
  }, [eventId])

  if (!evento) return <p className="text-profundo/70">Cargando…</p>
  const conPuntos = bloques.filter((b) => !b.is_practice)
  const delBloque = (blockId: string, teamId: string) => porBloque.find((x) => x.block_id === blockId && x.team_id === teamId)?.total ?? 0

  return (
    <div className="flex flex-col gap-4">
      <Link to="/admin/historial" className="text-sm font-semibold text-azul">
        ← Historial
      </Link>
      <div>
        <h1 className="text-3xl font-bold">{evento.name}</h1>
        <p className="text-profundo/70">{[formatearFecha(evento.date), evento.venue, evento.code].filter(Boolean).join(' · ')}</p>
      </div>

      <Tarjeta titulo="Podio">
        <ol className="grid gap-3 sm:grid-cols-3">
          {ranking.slice(0, 3).map((r) => (
            <li key={r.team_id} className={`rounded-xl p-4 text-center ${r.position === 1 ? 'bg-amarillo' : 'bg-crema'}`}>
              <p className="font-titulo text-3xl font-bold">{r.position === 1 ? '★ 1°' : `${r.position}°`}</p>
              <p className="text-lg font-bold">{r.name}</p>
              <p className="font-titulo">{formatearNumero(r.total)}</p>
            </li>
          ))}
        </ol>
      </Tarjeta>

      <Tarjeta titulo="Ranking por bloque">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase tracking-wide text-profundo/50">
              <tr>
                <th className="py-1 pr-2">#</th>
                <th className="py-1 pr-2">Mesa</th>
                {conPuntos.map((b) => (
                  <th key={b.id} className="py-1 pr-2 text-right">
                    {b.title}
                  </th>
                ))}
                <th className="py-1 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {ranking.map((r) => (
                <tr key={r.team_id} className="border-t border-profundo/10">
                  <td className="py-2 pr-2 text-profundo/60">{r.position}</td>
                  <td className="py-2 pr-2 font-semibold">
                    <button onClick={() => setAbierta(abierta === r.team_id ? null : r.team_id)} className="text-left hover:underline">
                      {r.name}
                    </button>
                    {abierta === r.team_id && (
                      <ul className="mt-1 text-xs font-normal text-profundo/70">
                        {movimientos
                          .filter((m) => m.team_id === r.team_id)
                          .map((m, i) => (
                            <li key={i} className={m.voided ? 'line-through opacity-50' : ''}>
                              {m.reason}
                              {m.origin === 'manual' && ' (manual)'}: {m.points > 0 ? '+' : ''}
                              {formatearNumero(m.points)}
                            </li>
                          ))}
                      </ul>
                    )}
                  </td>
                  {conPuntos.map((b) => (
                    <td key={b.id} className="py-2 pr-2 text-right tabular-nums">
                      {formatearNumero(delBloque(b.id, r.team_id))}
                    </td>
                  ))}
                  <td className="py-2 text-right font-titulo font-semibold tabular-nums">{formatearNumero(r.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-profundo/60">Tocá el nombre de una mesa para ver de dónde salió cada punto.</p>
      </Tarjeta>
    </div>
  )
}
