import { formatearNumero } from '../dynamics/solucion'
import type { FilaRanking, Live } from '../lib/tipos'

/**
 * Fase final: podio 1-2-3 grande, el resto de la tabla y el cierre. También con el botón «Podio» del
 * conductor en cualquier momento (enCualquierMomento): mismo podio, sin despedida (la noche sigue).
 */
export function Podio({ live, enCualquierMomento = false }: { live: Live; enCualquierMomento?: boolean }) {
  const [primero, segundo, tercero] = live.ranking
  const resto = live.ranking.slice(3)

  return (
    <div className="flex h-full flex-col px-[4cqw] pb-[2cqw] pt-[3cqw]">
      <div className="libre-logo-derecha">
        <h1 className="font-titulo text-[4.2cqw] font-bold leading-none">{enCualquierMomento ? '¡El podio de la noche!' : '¡Gracias por jugar!'}</h1>
        <p className="mt-[0.6cqw] text-[1.8cqw] font-semibold text-white/85">
          {live.event.name} · seguinos en <span className="font-extrabold text-white">@familia.ludica</span>
        </p>
      </div>

      <div className="mt-[1.5cqw] flex flex-1 items-end justify-center gap-[1.5cqw]">
        <Escalon fila={segundo} puesto={2} alto="62%" />
        <Escalon fila={primero} puesto={1} alto="85%" />
        <Escalon fila={tercero} puesto={3} alto="45%" />
      </div>

      {resto.length > 0 && (
        <ol className="mt-[1.5cqw] grid grid-cols-3 gap-x-[2cqw] gap-y-[0.3cqw] rounded-[1.2cqw] bg-profundo/40 px-[2cqw] py-[1cqw] text-[1.3cqw] font-semibold">
          {resto.map((r) => (
            <li key={r.team_id} className="flex gap-[0.6cqw]">
              <span className="w-[2cqw] text-white/75">{r.position}</span>
              <span className="min-w-0 flex-1 truncate">{r.name}</span>
              <span className="tabular-nums">{formatearNumero(r.total)}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}

/** Escalones blancos (sin fondo amarillo). El ganador: estrella y nombre más grande. Con empate, el
 * número es el puesto del ranking (dos mesas empatadas arriba son las dos 1°, con estrella). */
function Escalon({ fila, puesto, alto }: { fila: FilaRanking | undefined; puesto: number; alto: string }) {
  const ganador = puesto === 1
  return (
    <div className={`flex h-full flex-col justify-end ${ganador ? 'w-[28cqw]' : 'w-[21cqw]'}`}>
      {fila && (
        <div
          className="motion-safe:animate-aparecer flex flex-col items-center justify-start gap-[0.6cqw] rounded-t-[1.8cqw] bg-white px-[1.2cqw] pt-[1.4cqw] text-center text-profundo shadow-2xl"
          style={{ height: alto, animationDelay: `${(4 - puesto) * 250}ms` }}
        >
          {fila.position === 1 && (
            <span className={`leading-none text-naranja ${ganador ? 'text-[4.5cqw]' : 'text-[3cqw]'}`} aria-hidden>
              ★
            </span>
          )}
          <span className={`font-titulo font-bold leading-none ${ganador ? 'text-[3.4cqw] text-naranja' : 'text-[4cqw]'}`}>{fila.position}°</span>
          <span
            className={`line-clamp-2 font-titulo font-bold leading-tight ${ganador ? 'text-[3.6cqw]' : 'text-[2.2cqw] font-semibold'}`}
          >
            {fila.name}
          </span>
          <span className={`font-titulo font-bold tabular-nums ${ganador ? 'text-[2.6cqw]' : 'text-[2cqw]'}`}>
            {formatearNumero(fila.total)}
          </span>
        </div>
      )}
    </div>
  )
}
