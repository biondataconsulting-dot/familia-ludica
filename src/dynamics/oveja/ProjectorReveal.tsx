import { consigna } from '../solucion'
import type { PropsProyector } from '../tipos'
import { OvejaNegra } from './OvejaNegra'
import { agrupar } from './validate'

const MOSTRADOS = 6

/** Las respuestas agrupadas con cuántas mesas eligieron cada una; el rebaño ganador destacado. */
export function ProjectorReveal({ item, puntos = [] }: PropsProyector) {
  const { grupos, ovejaNegra, unanimidad, empate } = agrupar(puntos)
  const visibles = grupos.slice(0, MOSTRADOS)
  const sueltas = grupos.slice(MOSTRADOS).reduce((n, g) => n + g.tam, 0)
  const max = Math.max(1, ...grupos.map((g) => g.tam))

  return (
    <div className="flex flex-col gap-[0.9cqw]">
      <p className="line-clamp-2 font-titulo text-[2.2cqw] font-semibold leading-[1.15] text-profundo/80">{consigna(item.type, item.content)}</p>
      {grupos.length === 0 ? (
        <p className="text-[2cqw] font-semibold">Nadie respondió.</p>
      ) : (
        <ol className="flex flex-col gap-[0.4cqw]">
          {visibles.map((g) => (
            <li key={g.grupo} className="flex items-center gap-[1cqw]">
              <span className={`min-w-0 flex-1 truncate font-titulo text-[2.2cqw] font-bold ${g.mayoria ? 'text-naranja' : ''}`}>
                {g.mayoria && '🐑 '}
                {g.etiqueta}
              </span>
              <span className="relative h-[2cqw] w-[22cqw] shrink-0 overflow-hidden rounded-full bg-profundo/10">
                <span
                  className={`absolute inset-y-0 left-0 rounded-full ${g.mayoria ? 'bg-naranja' : 'bg-azul/60'}`}
                  style={{ width: `${(g.tam / max) * 100}%` }}
                />
              </span>
              <span className="w-[7cqw] shrink-0 text-right text-[1.7cqw] font-bold tabular-nums">
                {g.tam} {g.tam === 1 ? 'mesa' : 'mesas'}
              </span>
            </li>
          ))}
        </ol>
      )}
      {sueltas > 0 && <p className="text-[1.5cqw] font-semibold text-profundo/75">Y {sueltas} respuestas sueltas más.</p>}
      {unanimidad && <p className="font-titulo text-[2.2cqw] font-bold">¡Todas pensaron igual! Nadie suma 😅</p>}
      {empate && <p className="font-titulo text-[2.2cqw] font-bold">¡Empate arriba! Nadie suma 🤷</p>}
      {ovejaNegra && <OvejaNegra mesa={ovejaNegra} />}
    </div>
  )
}
