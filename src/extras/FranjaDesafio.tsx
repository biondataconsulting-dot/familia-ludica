import { formatearNumero } from '../dynamics/solucion'
import type { ExtrasPublicos } from './rpc'

/** Alto de la franja: la capa de contenido del proyector se achica esto mismo para no quedar tapada. */
export const ALTO_FRANJA = 'h-[6.5cqw]'

/** Proyector: el desafío en curso, en una franja abajo, mientras nadie lo ganó. */
export function FranjaDesafio({ desafio }: { desafio: NonNullable<ExtrasPublicos['desafio']> }) {
  return (
    <div
      role="status"
      className={`absolute inset-x-0 bottom-0 z-20 flex items-center gap-[1.6cqw] bg-naranja px-[3cqw] text-white shadow-2xl ${ALTO_FRANJA}`}
    >
      <span className="shrink-0 rounded-full bg-white px-[1.2cqw] py-[0.3cqw] font-titulo text-[1.6cqw] font-bold uppercase text-naranja">
        ⚡ Desafío
      </span>
      <span className="min-w-0 flex-1 truncate font-titulo text-[2.6cqw] font-semibold">{desafio.title}</span>
      <span className="shrink-0 font-titulo text-[2.6cqw] font-bold">+{formatearNumero(desafio.points)}</span>
    </div>
  )
}
