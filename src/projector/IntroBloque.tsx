import { metaDe } from '../dynamics/registro'
import type { Live } from '../lib/tipos'
import { SelloPractica } from './BarraSuperior'

/** Fase block_intro: nombre de la dinámica, cómo se juega y cuántos ítems tiene. */
export function IntroBloque({ live }: { live: Live }) {
  if (!live.block) return null
  const { block } = live
  const meta = metaDe(block.dynamic)
  const plural = block.total_items === 1 ? meta.sustantivo : `${meta.sustantivo}s`.replace('ións', 'iones')

  return (
    <div className="flex h-full flex-col items-center justify-center gap-[2.5cqw] px-[10cqw] text-center">
      <p className="text-[2cqw] font-bold uppercase tracking-[0.2em] text-celeste">
        Bloque {block.number} de {block.total_blocks}
      </p>
      <h1 className="font-titulo text-[7cqw] font-bold leading-none">{block.title}</h1>
      {block.is_practice && <SelloPractica />}
      <p className="max-w-[70cqw] text-[2.6cqw] leading-snug text-white/90">{meta.comoSeJuega}</p>
      <div className="flex items-center gap-[1cqw]">
        <p className="rounded-full bg-white/15 px-[2cqw] py-[0.6cqw] font-titulo text-[2.2cqw] font-semibold">
          {block.total_items} {plural}
        </p>
        {block.multiplier !== 1 && !block.is_practice && (
          <p className="rounded-full bg-naranja px-[2cqw] py-[0.6cqw] font-titulo text-[2.2cqw] font-semibold">
            puntos ×{block.multiplier}
          </p>
        )}
      </div>
    </div>
  )
}
