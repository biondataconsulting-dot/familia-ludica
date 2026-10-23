import { dinamicaDe } from '../dynamics/registro'
import { describirSolucion, formatearNumero } from '../dynamics/solucion'
import { DecoBloque } from './DecoBloque'
import type { Live, Revelado as DatosRevelado } from '../lib/tipos'
import { BarraSuperior } from './BarraSuperior'
import { ContenidoItem } from './ContenidoItem'
import { FilaPuesto } from './FilaPuesto'

/**
 * Fase item_revealed: la solución, las mesas que sumaron (chips debajo) y, a la derecha,
 * "Así va la noche": top 5 con flechas de cambio de posición. En práctica: "Así hubieran sumado".
 */
export function Revelado({ live }: { live: Live }) {
  const revelado = live.revealed as DatosRevelado | null
  if (!live.item || !revelado) return null
  const { item } = live
  const sol = revelado.solution
  const conVistaPropia = dinamicaDe(live.block?.dynamic) != null
  const sumaron = revelado.points.filter((p) => p.points > 0)
  const explicacion = typeof sol.explicacion === 'string' ? sol.explicacion : ''

  return (
    <div className="flex h-full flex-col gap-[1.6cqw] px-[3cqw] pb-[2cqw] pt-[2.5cqw]">
      <BarraSuperior live={live} />

      <div className="flex min-h-0 flex-1 gap-[2cqw]">
        <div className="flex min-w-0 flex-1 flex-col gap-[1.2cqw]">
          <div className="relative flex min-h-0 flex-1 flex-col justify-center gap-[1.5cqw] rounded-[2cqw] bg-crema p-[3cqw] text-profundo shadow-2xl">
            <DecoBloque emoji={live.block?.emoji} />
            {conVistaPropia ? (
              <ContenidoItem dinamica={live.block?.dynamic} item={item} solucion={sol} puntos={revelado.points} />
            ) : (
              <>
                <p className="text-[2cqw] font-bold uppercase tracking-wide text-profundo/60">La respuesta</p>
                <p className="font-titulo text-[6cqw] font-bold leading-none text-naranja">
                  {describirSolucion(item.type, item.content, sol)}
                </p>
              </>
            )}
            {explicacion && <p className="text-[2cqw] font-semibold text-profundo/75">{explicacion}</p>}
          </div>

          {!revelado.practice && (
            <div className="flex min-h-[3.2cqw] flex-wrap items-center gap-[0.7cqw]">
              {sumaron.length === 0 ? (
                <p className="text-[1.6cqw] font-semibold text-white/80">Esta vez ninguna mesa sumó.</p>
              ) : (
                sumaron.map((p) => (
                  <span key={p.team_id} className="rounded-full bg-white px-[1.1cqw] py-[0.3cqw] text-[1.35cqw] font-bold text-profundo">
                    {p.name} <span className="text-naranja">+{formatearNumero(p.points)}</span>
                  </span>
                ))
              )}
            </div>
          )}
        </div>

        {/* Columna derecha, debajo del logo de la esquina. */}
        <aside className="debajo-del-logo flex w-[22cqw] shrink-0 flex-col gap-[0.6cqw] pt-[1cqw]">
          {revelado.practice ? <HubieranSumado puntos={sumaron} /> : <AsiVaLaNoche live={live} antes={revelado.ranking_antes ?? {}} />}
        </aside>
      </div>
    </div>
  )
}

function AsiVaLaNoche({ live, antes }: { live: Live; antes: Record<string, number> }) {
  const top = live.ranking.slice(0, 5)
  return (
    <>
      <p className="font-titulo text-[2cqw] font-semibold">Así va la noche</p>
      {top.map((r) => (
        <FilaPuesto
          key={r.team_id}
          puesto={r.position}
          nombre={r.name}
          total={r.total}
          movimiento={antes[r.team_id] !== undefined ? antes[r.team_id]! - r.position : undefined}
          tam={1.35}
        />
      ))}
    </>
  )
}

function HubieranSumado({ puntos }: { puntos: DatosRevelado['points'] }) {
  return (
    <>
      <p className="font-titulo text-[2cqw] font-semibold">Así hubieran sumado</p>
      {puntos.length === 0 ? (
        <p className="text-[1.5cqw] font-semibold text-white/80">Esta vez ninguna mesa.</p>
      ) : (
        puntos.slice(0, 8).map((p) => (
          <div
            key={p.team_id}
            className="flex items-center justify-between gap-[0.8cqw] rounded-[0.8cqw] bg-white px-[1cqw] py-[0.4cqw] text-[1.35cqw] font-bold text-profundo"
          >
            <span className="truncate">{p.name}</span>
            <span className="shrink-0 text-naranja">+{formatearNumero(p.points)}</span>
          </div>
        ))
      )}
    </>
  )
}
