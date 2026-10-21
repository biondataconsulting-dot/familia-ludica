import type { PropsProyector } from '../tipos'
import { Visual } from './Visual'

/** La imagen más chica y la respuesta en grande, en naranja. */
export function ProjectorReveal({ item, solucion = {} }: PropsProyector) {
  return (
    <div className="flex flex-col items-center gap-[1.2cqw] text-center">
      <Visual contenido={item.content} chico />
      <p className="font-titulo text-[5.5cqw] font-bold leading-none text-naranja">{String(solucion.respuesta ?? '')}</p>
    </div>
  )
}
