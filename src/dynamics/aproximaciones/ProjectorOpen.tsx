import type { PropsProyector } from '../tipos'

/** La pregunta, la unidad en la que hay que responder y, si hay, una imagen. */
export function ProjectorOpen({ item }: PropsProyector) {
  const unidad = typeof item.content.unidad === 'string' ? item.content.unidad : ''
  const imagen = typeof item.content.imagen === 'string' && /^(https?:)?\//.test(item.content.imagen) ? item.content.imagen : null
  const pista = item.content.formato === 'anio' ? 'Respondan con un año' : unidad ? `Respondan en ${unidad}` : 'Respondan con un número'

  return (
    <div className="flex items-center gap-[3cqw]">
      <div className="flex flex-1 flex-col gap-[2cqw]">
        <p className="font-titulo text-[4.2cqw] font-semibold leading-[1.15]">{String(item.content.texto ?? '')}</p>
        <p className="self-start rounded-full bg-azul px-[1.6cqw] py-[0.5cqw] text-[2cqw] font-bold text-white">{pista}</p>
      </div>
      {imagen && <img src={imagen} alt="" className="max-h-[28cqw] max-w-[28cqw] rounded-[1.2cqw] object-cover" />}
    </div>
  )
}
