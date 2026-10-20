import { consigna } from '../solucion'
import type { PropsProyector } from '../tipos'

const CATEGORIA: Record<string, string> = { pelicula: 'Película', serie: 'Serie', dibujo: 'Dibujo animado', musica: 'Video' }

/**
 * La escena se VE: este marco reserva el lugar y el player del proyector (ReproductorOculto) se
 * ubica encima, recortado para que no se vean el título ni el logo de YouTube.
 */
export function ProjectorOpen({ item }: PropsProyector) {
  const categoria = CATEGORIA[String(item.content.categoria ?? 'pelicula')]
  return (
    <div className="flex flex-col items-center gap-[1.4cqw] text-center">
      <div data-marco-video className="aspect-video h-[27cqw] rounded-[1cqw] bg-profundo" />
      <div className="flex items-center gap-[1.2cqw]">
        <p className="font-titulo text-[3.4cqw] font-semibold leading-tight">{consigna(item.type, item.content)}</p>
        {categoria && <p className="rounded-full bg-azul px-[1.4cqw] py-[0.3cqw] text-[1.6cqw] font-bold text-white">{categoria}</p>}
      </div>
    </div>
  )
}
