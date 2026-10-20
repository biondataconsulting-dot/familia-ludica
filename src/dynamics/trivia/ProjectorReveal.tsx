import type { PropsProyector } from '../tipos'
import { Tarjeta } from './Tarjeta'

export function ProjectorReveal({ item, solucion }: PropsProyector) {
  return <Tarjeta item={item} solucion={solucion ?? {}} />
}
