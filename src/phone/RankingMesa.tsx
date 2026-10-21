import { formatearNumero } from '../dynamics/solucion'
import type { Live } from '../lib/tipos'

/** Botón "Cómo va la noche" del conductor, en el celular: el puesto de esta mesa y el top 5. */
export function RankingMesa({ live, teamId }: { live: Live; teamId: string }) {
  const mia = live.ranking.find((r) => r.team_id === teamId)
  const top = live.ranking.slice(0, 5)

  return (
    <section aria-label="Cómo va la noche" className="mb-4 rounded-carta bg-azul p-4 text-white shadow-md">
      <h2 className="font-titulo text-xl font-semibold">📊 Así va la noche</h2>
      {mia ? (
        <p className="mt-1 text-lg">
          Están <span className="font-titulo text-3xl font-bold">{mia.position}°</span> con{' '}
          <span className="font-bold">{formatearNumero(mia.total)}</span> puntos
        </p>
      ) : (
        <p className="mt-1">Todavía no tienen puntos.</p>
      )}
      {top.length > 0 && (
        <ol className="mt-3 flex flex-col gap-1 rounded-xl bg-white/10 p-2">
          {top.map((r) => (
            <li key={r.team_id} className={`flex items-center gap-2 rounded-lg px-2 py-1 ${r.team_id === teamId ? 'bg-white font-bold text-profundo' : ''}`}>
              <span className="w-7 font-titulo font-bold">{r.position}°</span>
              <span className="min-w-0 flex-1 truncate">{r.name}</span>
              <span className="font-titulo font-semibold tabular-nums">{formatearNumero(r.total)}</span>
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}
