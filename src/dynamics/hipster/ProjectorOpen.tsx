import { consigna } from '../solucion'
import type { PropsProyector } from '../tipos'

const CATEGORIA: Record<string, string> = { musica: 'Música', pelicula: 'Película', serie: 'Serie', dibujo: 'Dibujo animado' }

/** Ecualizador y la pregunta. Del video no se muestra nada: suena detrás de esta tarjeta. */
export function ProjectorOpen({ item }: PropsProyector) {
  const categoria = CATEGORIA[String(item.content.categoria ?? 'musica')]
  return (
    <div className="flex flex-col items-center gap-[2.5cqw] text-center">
      <Ecualizador />
      <p className="font-titulo text-[4.4cqw] font-semibold leading-[1.1]">{consigna(item.type, item.content)}</p>
      {categoria && <p className="rounded-full bg-azul px-[1.6cqw] py-[0.4cqw] text-[1.8cqw] font-bold text-white">{categoria}</p>}
    </div>
  )
}

function Ecualizador() {
  const barras = [0.6, 1, 0.75, 0.9, 0.5, 0.85, 0.65]
  return (
    <div className="flex h-[10cqw] items-end gap-[0.8cqw]" aria-hidden>
      {barras.map((alto, i) => (
        <span
          key={i}
          className="w-[1.6cqw] origin-bottom animate-ecualizador rounded-full bg-naranja"
          style={{ height: `${alto * 100}%`, animationDelay: `${i * 110}ms` }}
        />
      ))}
    </div>
  )
}
