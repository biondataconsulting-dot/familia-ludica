import { dinamicaDe } from '../dynamics/registro'
import { describirSolucion, formatearNumero } from '../dynamics/solucion'
import type { Live, Revelado as DatosRevelado } from '../lib/tipos'
import { BarraSuperior } from './BarraSuperior'
import { ContenidoItem } from './ContenidoItem'

/** Fase item_revealed: la solución y las mesas que sumaron. (El top 5 "Así va la noche" llega en el paso 8.) */
export function Revelado({ live }: { live: Live }) {
  const revelado = live.revealed as DatosRevelado | null
  if (!live.item || !revelado) return null
  const { item } = live
  const sol = revelado.solution
  const conVistaPropia = dinamicaDe(live.block?.dynamic) != null
  const sumaron = revelado.points.filter((p) => p.points > 0)
  const explicacion = typeof sol.explicacion === 'string' ? sol.explicacion : ''

  return (
    <div className="flex h-full flex-col gap-[1.8cqw] px-[3cqw] pb-[2cqw] pt-[2.5cqw]">
      <BarraSuperior live={live} />

      <div className="flex min-h-0 flex-1 gap-[2cqw]">
        <div className="flex min-w-0 flex-1 flex-col justify-center gap-[1.5cqw] rounded-[2cqw] bg-crema p-[3cqw] text-profundo shadow-2xl">
          {conVistaPropia ? (
            <ContenidoItem dinamica={live.block?.dynamic} item={item} solucion={sol} />
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

        {/* Columna derecha, debajo del logo de la esquina (en el paso 8 suma "Así va la noche"). */}
        <aside className="flex w-[17cqw] shrink-0 flex-col gap-[0.8cqw] pt-[7cqw]">
          <p className="font-titulo text-[1.9cqw] font-semibold">{revelado.practice ? 'Así hubieran sumado' : 'Sumaron'}</p>
          {sumaron.length === 0 ? (
            <p className="text-[1.5cqw] font-semibold text-white/80">Esta vez ninguna mesa.</p>
          ) : (
            <ul className="flex flex-col gap-[0.6cqw] overflow-hidden">
              {sumaron.map((p) => (
                <li
                  key={p.team_id}
                  className="flex items-center justify-between gap-[0.8cqw] rounded-[0.8cqw] bg-white px-[1cqw] py-[0.4cqw] text-[1.35cqw] font-bold text-profundo"
                >
                  <span className="truncate">{p.name}</span>
                  <span className="shrink-0 text-naranja">+{formatearNumero(p.points)}</span>
                </li>
              ))}
            </ul>
          )}
        </aside>
      </div>
    </div>
  )
}
