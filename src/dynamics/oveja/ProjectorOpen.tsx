import { consigna } from '../solucion'
import type { PropsProyector } from '../tipos'

/** La pregunta en grande y el recordatorio de la regla. */
export function ProjectorOpen({ item }: PropsProyector) {
  return (
    <div className="flex flex-col gap-[2cqw]">
      <p className="text-[5cqw] leading-none" aria-hidden>
        🐑🐑🐑
      </p>
      <p className="font-titulo text-[4.4cqw] font-semibold leading-[1.1]">{consigna(item.type, item.content)}</p>
      <p className="text-[1.9cqw] font-semibold text-profundo/75">Escriban lo que va a responder la mayoría.</p>
    </div>
  )
}
