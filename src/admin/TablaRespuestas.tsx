import { useEffect, useState } from 'react'
import { dinamicaDe } from '../dynamics/registro'
import { formatearNumero } from '../dynamics/solucion'
import { ErrorRpc } from '../lib/rpc'
import { admin } from '../lib/rpcAdmin'
import type { Live, Revelado } from '../lib/tipos'
import { GruposOveja } from './GruposOveja'
import { useRespuestasAdmin, type RespuestaAdmin } from './useRespuestasAdmin'

type Props = {
  live: Live
  eventId: string
  /** Avisa cuántas dudosas quedan sin decidir (para advertir antes de revelar). */
  onDudosas?: (n: number) => void
}

/**
 * Centro del panel: mesa, respuesta, estado y puntos (provisorios hasta revelar).
 * Campos de texto validados (Hitster y Cine): estado por campo, Aceptar / Rechazar en las dudosas y
 * corrección de lo que el sistema decidió solo.
 * Las mesas sin respuesta van al final.
 */
export function TablaRespuestas({ live, eventId, onDudosas }: Props) {
  const item = live.item
  const { respuestas, provisorios, recargar } = useRespuestasAdmin(eventId, item?.block_item_id, `${live.answers_count}|${live.phase}`)
  const dinamica = dinamicaDe(live.block?.dynamic)
  const dudosas = respuestas.reduce((n, r) => n + Object.values(r.validation ?? {}).filter((v) => v === 'dudosa').length, 0)

  useEffect(() => {
    onDudosas?.(item ? dudosas : 0)
  }, [dudosas, item, onDudosas])

  if (!item) return <p className="text-profundo/70">Cuando abras un ítem, acá vas a ver las respuestas.</p>

  const revelado = live.phase === 'item_revealed' ? (live.revealed as Revelado | null) : null
  const puntos = new Map((revelado?.points ?? provisorios).map((p) => [p.team_id, p]))
  const porMesa = new Map(respuestas.map((r) => [r.team_id, r]))
  const conRespuesta = live.teams.filter((m) => porMesa.has(m.id))
  const sinRespuesta = live.teams.filter((m) => !porMesa.has(m.id))
  const puedeDecidir = live.phase === 'item_closed'

  return (
    <div className="overflow-x-auto">
      {dudosas > 0 && (
        <p className="mb-2 rounded-xl bg-naranja/15 px-3 py-2 text-sm font-bold">
          Quedan {dudosas} {dudosas === 1 ? 'dudosa' : 'dudosas'}.{' '}
          {puedeDecidir ? 'Si revelás sin decidir, cuentan como rechazadas.' : 'Se deciden al cerrar las respuestas.'}
        </p>
      )}
      {live.block?.dynamic === 'oveja' && respuestas.length > 0 && (
        <GruposOveja
          respuestas={respuestas}
          mesas={live.teams}
          blockItemId={item.block_item_id}
          editable={puedeDecidir}
          onCambio={recargar}
        />
      )}
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
              <tr key={m.id} className="border-t border-profundo/10 align-top">
                <td className="py-2 pr-2 font-semibold">{m.name}</td>
                <td className="py-2 pr-2">{dinamica ? dinamica.describir(item.content, r.answer) : JSON.stringify(r.answer)}</td>
                <td className="py-2 pr-2">
                  {correcta === true && <span className="font-bold text-green-700">✔ correcta</span>}
                  {correcta === false && <span className="font-bold text-naranja">✘ incorrecta</span>}
                  <Validaciones respuesta={r} puedeDecidir={puedeDecidir} onCambio={recargar} esEscena={item.type === 'clip_video'} />
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

const ETIQUETA: Record<string, { texto: string; clase: string }> = {
  auto_ok: { texto: '✔ ok', clase: 'text-green-700' },
  aceptada: { texto: '✔ aceptada', clase: 'text-green-700' },
  auto_no: { texto: '✘ no', clase: 'text-profundo/50' },
  rechazada: { texto: '✘ rechazada', clase: 'text-profundo/50' },
  dudosa: { texto: '? dudosa', clase: 'text-naranja' },
}
const NOMBRE_CAMPO: Record<string, string> = { titulo: 'Título', artista: 'Artista', respuesta: 'Respuesta' }

const ACEPTADO = ['auto_ok', 'aceptada']

type PropsValidaciones = { respuesta: RespuestaAdmin; puedeDecidir: boolean; onCambio: () => void; esEscena: boolean }

/** Dudosas: Aceptar / Rechazar. Ya decididas (por el sistema o el conductor): se pueden dar vuelta. */
function Validaciones({ respuesta, puedeDecidir, onCambio, esEscena }: PropsValidaciones) {
  const [ocupado, setOcupado] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const campos = Object.entries(respuesta.validation ?? {}).filter(([c]) => c in NOMBRE_CAMPO)
  if (campos.length === 0) return null

  async function decidir(campo: 'titulo' | 'artista' | 'respuesta', valor: 'aceptada' | 'rechazada') {
    setOcupado(true)
    setError(null)
    try {
      await admin.setValidation(respuesta.id, campo, valor)
      onCambio()
    } catch (e) {
      setError(e instanceof ErrorRpc ? e.message : 'No se pudo.')
    } finally {
      setOcupado(false)
    }
  }

  return (
    <div className="flex flex-col gap-1">
      {campos.map(([campo, estado]) => {
        const e = ETIQUETA[estado] ?? { texto: estado, clase: '' }
        return (
          <div key={campo} className="flex flex-wrap items-center gap-1">
            <span className="text-xs text-profundo/60">{campo === 'artista' && esEscena ? 'Director' : NOMBRE_CAMPO[campo]}:</span>
            <span className={`text-xs font-bold ${e.clase}`}>{e.texto}</span>
            {estado === 'dudosa' && puedeDecidir && (
              <>
                <button
                  disabled={ocupado}
                  onClick={() => void decidir(campo as 'titulo', 'aceptada')}
                  className="rounded-lg bg-green-700 px-2 py-0.5 text-xs font-bold text-white disabled:opacity-40"
                >
                  Aceptar
                </button>
                <button
                  disabled={ocupado}
                  onClick={() => void decidir(campo as 'titulo', 'rechazada')}
                  className="rounded-lg border border-profundo/30 px-2 py-0.5 text-xs font-bold disabled:opacity-40"
                >
                  Rechazar
                </button>
              </>
            )}
            {estado !== 'dudosa' && puedeDecidir && (
              <button
                disabled={ocupado}
                onClick={() => void decidir(campo as 'titulo', ACEPTADO.includes(estado) ? 'rechazada' : 'aceptada')}
                className="rounded-lg px-1.5 py-0.5 text-xs font-semibold text-profundo/60 underline disabled:opacity-40"
              >
                {ACEPTADO.includes(estado) ? 'Rechazar' : 'Aceptar'}
              </button>
            )}
          </div>
        )
      })}
      {error && <span className="text-xs text-naranja">{error}</span>}
    </div>
  )
}
