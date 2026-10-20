import { describirSolucion } from '../solucion'
import type { PropsProyector } from '../tipos'
import { describir } from './validate'

type Detalle = { valor?: number; mas_cerca?: boolean }

/** El valor correcto en grande y la mesa (o mesas) que quedó más cerca, con lo que respondió. */
export function ProjectorReveal({ item, solucion = {}, puntos = [] }: PropsProyector) {
  const cercanas = puntos.filter((p) => (p.detail as Detalle | null)?.mas_cerca)

  return (
    <div className="flex flex-col gap-[1.6cqw]">
      <p className="font-titulo text-[3cqw] font-semibold leading-[1.15] text-profundo/80">{String(item.content.texto ?? '')}</p>
      <p className="font-titulo text-[8cqw] font-bold leading-none text-naranja">
        {describirSolucion(item.type, item.content, solucion)}
      </p>
      {cercanas.length > 0 && (
        <p className="text-[2.3cqw] font-semibold">
          {cercanas.length === 1 ? 'La más cerca: ' : 'Las más cerca: '}
          {cercanas.map((p, i) => (
            <span key={p.team_id}>
              {i > 0 && ', '}
              <span className="font-extrabold">{p.name}</span>
              <span className="text-profundo/60"> ({describir(item.content, { valor: (p.detail as Detalle).valor })})</span>
            </span>
          ))}
        </p>
      )}
    </div>
  )
}
