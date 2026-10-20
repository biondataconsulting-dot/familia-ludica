import type { PropsProyector } from '../tipos'
import { Tarjeta } from './Tarjeta'

export function ProjectorOpen({ item }: PropsProyector) {
  return <Tarjeta item={item} />
}
