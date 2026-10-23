import { opcionesDe } from '../opciones/validate'
import type { PropsProyector } from '../tipos'

/**
 * Tamaño de letra según la afirmación más larga, para que las tres entren siempre en la tarjeta
 * (también en el revelado, que suma la explicación abajo y la franja de un desafío).
 */
function tamanioAfirmaciones(afirmaciones: string[], revelado: boolean): { texto: string; numero: string; gap: string } {
  const largo = Math.max(0, ...afirmaciones.map((a) => a.length))
  if (largo <= 55) return { texto: revelado ? 'text-[2.3cqw]' : 'text-[2.6cqw]', numero: 'text-[3.2cqw]', gap: 'gap-[1cqw]' }
  if (largo <= 85) return { texto: revelado ? 'text-[2cqw]' : 'text-[2.2cqw]', numero: 'text-[2.8cqw]', gap: 'gap-[0.8cqw]' }
  return { texto: revelado ? 'text-[1.7cqw]' : 'text-[1.9cqw]', numero: 'text-[2.4cqw]', gap: 'gap-[0.6cqw]' }
}

/** Las tres afirmaciones. En el revelado, la mentira queda marcada y las verdades con tilde. */
export function Tarjeta({ item, solucion }: PropsProyector) {
  const afirmaciones = opcionesDe(item, 'afirmaciones')
  const mentira = solucion ? Number(solucion.mentira) : null
  const revelado = mentira != null
  const t = tamanioAfirmaciones(afirmaciones, revelado)

  return (
    <div className={`flex flex-col ${revelado ? 'gap-[1cqw]' : 'gap-[1.6cqw]'}`}>
      <p className={`font-titulo font-semibold leading-none ${revelado ? 'text-[3cqw]' : 'text-[3.6cqw]'}`}>
        {revelado ? 'La mentira era…' : '¿Cuál es la mentira?'}
      </p>
      <ol className={`flex flex-col ${t.gap}`}>
        {afirmaciones.map((a, i) => {
          const esMentira = mentira === i
          return (
            <li
              key={i}
              className={`flex items-center gap-[1.4cqw] rounded-[1.2cqw] px-[1.6cqw] py-[0.7cqw] font-semibold leading-snug transition-colors duration-500 ${t.texto} ${
                esMentira ? 'bg-naranja text-white' : revelado ? 'bg-profundo/5 text-profundo/50' : 'bg-profundo/5'
              }`}
            >
              <span className={`font-titulo font-bold ${t.numero}`}>{i + 1}</span>
              <span className="flex-1">{a}</span>
              {revelado && <span className="text-[1.6cqw] font-extrabold uppercase">{esMentira ? 'Mentira' : 'Verdad'}</span>}
            </li>
          )
        })}
      </ol>
    </div>
  )
}
