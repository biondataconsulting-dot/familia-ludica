import { metaDe } from '../dynamics/registro'
import type { Live } from '../lib/tipos'

/** Dinámica, sello de práctica y "pregunta 3 de 8". Deja libre la esquina del logo. */
export function BarraSuperior({ live }: { live: Live }) {
  const { block, item } = live
  if (!block) return null
  const meta = metaDe(block.dynamic)

  return (
    <div className="libre-logo-derecha flex items-center gap-[1.5cqw]">
      <p className="font-titulo text-[2.4cqw] font-semibold">{block.title}</p>
      {block.is_practice && <SelloPractica />}
      {item && (
        <p className="ml-auto rounded-full bg-white/15 px-[1.4cqw] py-[0.4cqw] text-[1.6cqw] font-bold">
          {meta.sustantivo} {item.number} de {block.total_items}
        </p>
      )}
    </div>
  )
}

export function SelloPractica() {
  return (
    <span className="-rotate-2 rounded-[0.6cqw] bg-naranja px-[1cqw] py-[0.25cqw] text-[1.3cqw] font-extrabold uppercase tracking-wide text-white shadow-md">
      Ronda de práctica · no suma puntos
    </span>
  )
}
