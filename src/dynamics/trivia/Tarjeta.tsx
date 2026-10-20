import { COLORES_OPCION } from '../colores'
import { opcionesDe } from '../opciones/validate'
import { letraOpcion } from '../solucion'
import type { PropsProyector } from '../tipos'

/** Pregunta y opciones A-D en el proyector. En el revelado, resalta la correcta y apaga el resto. */
export function Tarjeta({ item, solucion }: PropsProyector) {
  const opciones = opcionesDe(item, 'opciones')
  const correcta = solucion ? Number(solucion.correcta) : null

  return (
    <div className="flex flex-col gap-[2cqw]">
      <p className="font-titulo text-[4cqw] font-semibold leading-[1.15]">{String(item.content.texto ?? '')}</p>
      <ol className="grid grid-cols-2 gap-[1.2cqw]">
        {opciones.map((o, i) => (
          <li
            key={i}
            className={`flex items-center gap-[1.2cqw] rounded-[1.2cqw] px-[1.5cqw] py-[1cqw] text-[2.4cqw] font-bold transition-opacity duration-500 ${COLORES_OPCION[i % 4]} ${
              correcta != null && i !== correcta ? 'opacity-25' : ''
            } ${correcta != null && i === correcta ? 'ring-[0.5cqw] ring-profundo ring-offset-[0.4cqw] ring-offset-crema' : ''}`}
          >
            <span className="font-titulo text-[2.8cqw]">{letraOpcion(i)}</span>
            <span className="flex-1">{o}</span>
            {correcta === i && <span aria-label="correcta">✔</span>}
          </li>
        ))}
      </ol>
    </div>
  )
}
