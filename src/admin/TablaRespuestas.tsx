import { dinamicaDe } from '../dynamics/registro'
import { formatearNumero } from '../dynamics/solucion'
import type { Live, Revelado } from '../lib/tipos'
import { useRespuestasAdmin } from './useRespuestasAdmin'

/**
 * Centro del panel: mesa, respuesta, estado y puntos (provisorios hasta revelar).
 * Las mesas sin respuesta van al final. (Aceptar / Rechazar dudosas: Hipster, paso 9.)
 */
export function TablaRespuestas({ live, eventId }: { live: Live; eventId: string }) {
  const item = live.item
  const { respuestas, provisorios } = useRespuestasAdmin(eventId, item?.block_item_id, `${live.answers_count}|${live.phase}`)
  const dinamica = dinamicaDe(live.block?.dynamic)

  if (!item) return <p className="text-profundo/70">Cuando abras un ítem, acá vas a ver las respuestas.</p>

  const revelado = live.phase === 'item_revealed' ? (live.revealed as Revelado | null) : null
  const puntos = new Map((revelado?.points ?? provisorios).map((p) => [p.team_id, p]))
  const porMesa = new Map(respuestas.map((r) => [r.team_id, r]))
  const conRespuesta = live.teams.filter((m) => porMesa.has(m.id))
  const sinRespuesta = live.teams.filter((m) => !porMesa.has(m.id))

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead className="text-xs uppercase tracking-wide text-profundo/50">
          <tr>
            <th className="py-1 pr-2">Mesa</th>
            <th className="py-1 pr-2">Respuesta</th>
            <th className="py-1 pr-2">Estado</th>
            <th className="py-1 text-right">{revelado ? 'Puntos' : 'Provisorio'}</th>
          </tr>
        </thead>
        <tbody>
          {conRespuesta.map((m) => {
            const r = porMesa.get(m.id)!
            const p = puntos.get(m.id)
            const correcta = (p?.detail as { correcta?: boolean } | null)?.correcta
            return (
              <tr key={m.id} className="border-t border-profundo/10">
                <td className="py-2 pr-2 font-semibold">{m.name}</td>
                <td className="py-2 pr-2">{dinamica ? dinamica.describir(item.content, r.answer) : JSON.stringify(r.answer)}</td>
                <td className="py-2 pr-2">
                  {correcta === true && <span className="font-bold text-green-700">✔ correcta</span>}
                  {correcta === false && <span className="font-bold text-naranja">✘ incorrecta</span>}
                </td>
                <td className="py-2 text-right font-titulo text-base font-semibold tabular-nums">
                  {p ? formatearNumero(p.points) : '—'}
                </td>
              </tr>
            )
          })}
          {sinRespuesta.map((m) => (
            <tr key={m.id} className="border-t border-profundo/10 text-profundo/40">
              <td className="py-2 pr-2 font-semibold">{m.name}</td>
              <td className="py-2 pr-2" colSpan={2}>
                sin respuesta
              </td>
              <td className="py-2 text-right">0</td>
            </tr>
          ))}
        </tbody>
      </table>
      {revelado?.practice && <p className="mt-2 text-xs text-profundo/60">Ronda de práctica: estos puntos no se registran.</p>}
    </div>
  )
}
