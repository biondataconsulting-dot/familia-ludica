import { formatearNumero } from '../dynamics/solucion'
import type { FilaRanking, Live } from '../lib/tipos'

/** Fase final: podio 1-2-3 grande, el resto de la tabla y el cierre. */
export function Podio({ live }: { live: Live }) {
  const [primero, segundo, tercero] = live.ranking
  const resto = live.ranking.slice(3)

  return (
    <div className="flex h-full flex-col px-[4cqw] pb-[2cqw] pt-[3cqw]">
      <div className="pr-[12cqw]">
        <h1 className="font-titulo text-[4.2cqw] font-bold leading-none">¡Gracias por jugar!</h1>
        <p className="mt-[0.6cqw] text-[1.8cqw] font-semibold text-white/85">
          {live.event.name} · seguinos en <span className="font-extrabold text-white">@familia.ludica</span>
        </p>
      </div>

      <div className="mt-[1.5cqw] flex flex-1 items-end justify-center gap-[1.5cqw]">
        <Escalon fila={segundo} puesto={2} alto="62%" fondo="bg-white" />
        <Escalon fila={primero} puesto={1} alto="85%" fondo="bg-amarillo" />
        <Escalon fila={tercero} puesto={3} alto="45%" fondo="bg-celeste" />
      </div>

      {resto.length > 0 && (
        <ol className="mt-[1.5cqw] grid grid-cols-3 gap-x-[2cqw] gap-y-[0.3cqw] rounded-[1.2cqw] bg-profundo/40 px-[2cqw] py-[1cqw] text-[1.3cqw] font-semibold">
          {resto.map((r) => (
            <li key={r.team_id} className="flex gap-[0.6cqw]">
              <span className="w-[2cqw] text-white/60">{r.position}</span>
              <span className="min-w-0 flex-1 truncate">{r.name}</span>
              <span className="tabular-nums">{formatearNumero(r.total)}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}

function Escalon({ fila, puesto, alto, fondo }: { fila: FilaRanking | undefined; puesto: number; alto: string; fondo: string }) {
  return (
    <div className="flex h-full w-[22cqw] flex-col justify-end">
      {fila && (
        <div
          className={`motion-safe:animate-aparecer flex flex-col items-center justify-start gap-[0.6cqw] rounded-t-[1.8cqw] px-[1.2cqw] pt-[1.4cqw] text-center text-profundo shadow-2xl ${fondo}`}
          style={{ height: alto, animationDelay: `${(4 - puesto) * 250}ms` }}
        >
          <span className="font-titulo text-[5cqw] font-bold leading-none">{puesto}°</span>
          <span className="line-clamp-2 font-titulo text-[2.2cqw] font-semibold leading-tight">{fila.name}</span>
          <span className="font-titulo text-[2cqw] font-bold tabular-nums">{formatearNumero(fila.total)}</span>
        </div>
      )}
    </div>
  )
}
