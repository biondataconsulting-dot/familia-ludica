import { describirSolucion } from '../solucion'
import type { PropsProyector } from '../tipos'
import { describir } from './validate'

type Detalle = { valor?: number; diferencia?: number; puesto?: number }

const MOSTRADAS = 5

/** El valor correcto en grande y las 5 mesas que quedaron más cerca (empatadas, mismo puesto). El resto, con humor. */
export function ProjectorReveal({ item, solucion = {}, puntos = [] }: PropsProyector) {
  const ordenadas = puntos
    .map((p) => ({ ...p, d: Number((p.detail as Detalle | null)?.diferencia ?? Infinity) }))
    .sort((a, b) => a.d - b.d || a.name.localeCompare(b.name))
  const cercanas = ordenadas.slice(0, MOSTRADAS)
  const resto = ordenadas.length - cercanas.length
  // El puesto lo calcula la base (las empatadas comparten puesto); si faltara, se deduce del orden.
  const puesto = (p: (typeof ordenadas)[number]) => (p.detail as Detalle | null)?.puesto ?? ordenadas.findIndex((o) => o.d === p.d) + 1

  return (
    <div className="flex flex-col gap-[0.8cqw]">
      <p className="line-clamp-2 font-titulo text-[2cqw] font-semibold leading-[1.15] text-profundo/80">{String(item.content.texto ?? '')}</p>
      <p className="font-titulo text-[5cqw] font-bold leading-none text-naranja">{describirSolucion(item.type, item.content, solucion)}</p>
      {cercanas.length > 0 && (
        <div>
          <p className="mb-[0.2cqw] text-[1.3cqw] font-bold uppercase tracking-wide text-profundo/70">Las más cerca</p>
          <ol className="flex flex-col gap-[0.1cqw]">
            {cercanas.map((p) => (
              <li key={p.team_id} className="flex items-baseline gap-[1cqw] text-[1.75cqw] leading-tight">
                <span className="w-[2.6cqw] font-titulo font-bold text-naranja">{puesto(p)}°</span>
                <span className="min-w-0 flex-1 truncate font-extrabold">{p.name}</span>
                <span className="font-semibold text-profundo/75">{describir(item.content, { valor: (p.detail as Detalle).valor })}</span>
              </li>
            ))}
          </ol>
          {resto > 0 && <p className="mt-[0.3cqw] text-[1.6cqw] font-bold text-profundo/75">Las demás… mejor ni hablar 😂</p>}
        </div>
      )}
    </div>
  )
}
