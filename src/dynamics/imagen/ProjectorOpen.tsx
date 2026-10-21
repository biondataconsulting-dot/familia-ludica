import { consigna } from '../solucion'
import type { PropsProyector } from '../tipos'
import { Visual } from './Visual'

/** La imagen (o los emojis) en grande y la consigna abajo. */
export function ProjectorOpen({ item }: PropsProyector) {
  return (
    <div className="flex flex-col items-center gap-[1.6cqw] text-center">
      <Visual contenido={item.content} />
      <p className="font-titulo text-[3.4cqw] font-semibold leading-tight">{consigna(item.type, item.content)}</p>
    </div>
  )
}
