import { dinamicaDe } from '../dynamics/registro'
import { consigna } from '../dynamics/solucion'
import type { ItemActual, Revelado } from '../lib/tipos'

type Props = {
  dinamica: string | undefined
  item: ItemActual
  /** Solo en el revelado. */
  solucion?: Record<string, unknown>
  puntos?: Revelado['points']
}

/** Tarjeta central del proyector: la dibuja la dinámica; si todavía no tiene vista propia, solo la consigna. */
export function ContenidoItem({ dinamica, item, solucion, puntos }: Props) {
  const d = dinamicaDe(dinamica)
  if (d) {
    return solucion ? <d.ProjectorReveal item={item} solucion={solucion} puntos={puntos} /> : <d.ProjectorOpen item={item} />
  }
  return <p className="font-titulo text-[4cqw] font-semibold leading-[1.15]">{consigna(item.type, item.content)}</p>
}
