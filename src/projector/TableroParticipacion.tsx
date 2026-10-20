import type { Live } from '../lib/tipos'

/** Todas las mesas: tilde las que respondieron, punteadas las que faltan, apagadas las desconectadas. */
export function TableroParticipacion({ live }: { live: Live }) {
  const respondieron = new Set(live.answered)

  return (
    <ul className="flex flex-wrap justify-center gap-[0.7cqw]" aria-label="Mesas que respondieron">
      {live.teams.map((m) => {
        const listo = respondieron.has(m.id)
        const estilo = listo
          ? 'bg-white text-profundo'
          : m.connected
            ? 'border-[0.15cqw] border-dashed border-white/60 text-white/80'
            : 'border-[0.15cqw] border-naranja/70 text-white/35'
        return (
          <li key={m.id} className={`flex items-center gap-[0.4cqw] rounded-full px-[1.1cqw] py-[0.3cqw] text-[1.3cqw] font-bold ${estilo}`}>
            {listo && (
              <span className="text-[1.2cqw] text-green-600" aria-hidden>
                ✔
              </span>
            )}
            {m.name}
          </li>
        )
      })}
    </ul>
  )
}
