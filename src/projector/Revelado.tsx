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
  const indice =
    item.type === 'pregunta_opciones' ? Number(sol.correcta) : item.type === 'trio_verdad_mentira' ? Number(sol.mentira) : undefined
  const sumaron = revelado.points.filter((p) => p.points > 0)
  const explicacion = typeof sol.explicacion === 'string' ? sol.explicacion : ''

  return (
    <div className="flex h-full flex-col gap-[1.8cqw] px-[3cqw] pb-[2cqw] pt-[2.5cqw]">
      <BarraSuperior live={live} />

      <div className="flex min-h-0 flex-1 flex-col justify-center gap-[1.5cqw] rounded-[2cqw] bg-crema p-[3cqw] text-profundo shadow-2xl">
        {indice != null ? (
          <ContenidoItem item={item} correcta={indice} />
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

      <div className="flex min-h-[4.5cqw] flex-wrap items-center justify-center gap-[0.8cqw]">
        {sumaron.length > 0 && revelado.practice && (
          <p className="font-titulo text-[1.8cqw] font-semibold text-white">Así hubieran sumado:</p>
        )}
        {sumaron.length === 0 ? (
          <p className="text-[1.8cqw] font-semibold text-white/80">
            {revelado.practice ? 'Esta vez ninguna mesa hubiera sumado.' : 'Esta vez ninguna mesa sumó.'}
          </p>
        ) : (
          sumaron.map((p) => (
            <span key={p.team_id} className="rounded-full bg-white px-[1.2cqw] py-[0.35cqw] text-[1.4cqw] font-bold text-profundo">
              {p.name} <span className="text-naranja">+{formatearNumero(p.points)}</span>
            </span>
          ))
        )}
      </div>
    </div>
  )
}
