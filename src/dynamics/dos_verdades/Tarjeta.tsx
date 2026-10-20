import { opcionesDe } from '../opciones/validate'
import type { PropsProyector } from '../tipos'

/** Las tres afirmaciones. En el revelado, la mentira queda marcada y las verdades con tilde. */
export function Tarjeta({ item, solucion }: PropsProyector) {
  const afirmaciones = opcionesDe(item, 'afirmaciones')
  const mentira = solucion ? Number(solucion.mentira) : null

  return (
    <div className="flex flex-col gap-[1.8cqw]">
      <p className="font-titulo text-[4cqw] font-semibold leading-none">
        {mentira == null ? '¿Cuál es la mentira?' : 'La mentira era…'}
      </p>
      <ol className="flex flex-col gap-[1.2cqw]">
        {afirmaciones.map((a, i) => {
          const esMentira = mentira === i
          return (
            <li
              key={i}
              className={`flex items-center gap-[1.6cqw] rounded-[1.2cqw] px-[1.8cqw] py-[1cqw] text-[2.5cqw] font-semibold transition-colors duration-500 ${
                esMentira ? 'bg-naranja text-white' : mentira != null ? 'bg-profundo/5 text-profundo/50' : 'bg-profundo/5'
              }`}
            >
              <span className="font-titulo text-[3.4cqw] font-bold">{i + 1}</span>
              <span className="flex-1">{a}</span>
              {mentira != null && (
                <span className="text-[2cqw] font-extrabold uppercase">{esMentira ? 'Mentira' : 'Verdad'}</span>
              )}
            </li>
          )
        })}
      </ol>
    </div>
  )
}
