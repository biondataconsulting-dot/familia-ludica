import { COLORES_OPCION } from '../dynamics/colores'
import { consigna, letraOpcion } from '../dynamics/solucion'
import type { ItemActual } from '../lib/tipos'

type Props = {
  item: ItemActual
  /** Índice a resaltar (revelado). */
  correcta?: number
}

/** Consigna + opciones o afirmaciones, en la tarjeta central del proyector. */
export function ContenidoItem({ item, correcta }: Props) {
  const opciones = Array.isArray(item.content.opciones) ? (item.content.opciones as string[]) : []
  const afirmaciones = Array.isArray(item.content.afirmaciones) ? (item.content.afirmaciones as string[]) : []
  const unidad = typeof item.content.unidad === 'string' ? item.content.unidad : ''
  const hayResaltado = correcta != null

  return (
    <div className="flex flex-col gap-[2cqw]">
      <p className="font-titulo text-[4cqw] font-semibold leading-[1.15]">{consigna(item.type, item.content)}</p>
      {unidad && <p className="text-[2cqw] font-bold text-profundo/60">Respuesta en {unidad}</p>}

      {opciones.length > 0 && (
        <ol className="grid grid-cols-2 gap-[1.2cqw]">
          {opciones.map((o, i) => (
            <li
              key={i}
              className={`flex items-center gap-[1.2cqw] rounded-[1.2cqw] px-[1.5cqw] py-[1cqw] text-[2.4cqw] font-bold transition-opacity ${COLORES_OPCION[i % 4]} ${
                hayResaltado && i !== correcta ? 'opacity-25' : ''
              } ${hayResaltado && i === correcta ? 'ring-[0.5cqw] ring-amarillo' : ''}`}
            >
              <span className="font-titulo text-[2.8cqw]">{letraOpcion(i)}</span>
              {o}
            </li>
          ))}
        </ol>
      )}

      {afirmaciones.length > 0 && (
        <ol className="flex flex-col gap-[1cqw]">
          {afirmaciones.map((a, i) => (
            <li
              key={i}
              className={`flex items-center gap-[1.4cqw] rounded-[1.2cqw] bg-profundo/5 px-[1.5cqw] py-[0.8cqw] text-[2.3cqw] font-semibold transition-opacity ${
                hayResaltado && i !== correcta ? 'opacity-40' : ''
              } ${hayResaltado && i === correcta ? 'bg-naranja text-white' : ''}`}
            >
              <span className="font-titulo text-[3cqw] font-bold">{i + 1}</span>
              {a}
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}
