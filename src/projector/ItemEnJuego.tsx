import type { Temporizador } from '../live/useTemporizador'
import type { Live } from '../lib/tipos'
import { BarraSuperior } from './BarraSuperior'
import { ContenidoItem } from './ContenidoItem'
import { TableroParticipacion } from './TableroParticipacion'
import { TemporizadorCircular } from './TemporizadorCircular'

/** Fases item_open e item_closed: consigna, temporizador y tablero de quién respondió. */
export function ItemEnJuego({ live, temporizador }: { live: Live; temporizador: Temporizador }) {
  if (!live.item) return null
  const cerrado = live.phase === 'item_closed'

  return (
    <div className="flex h-full flex-col gap-[1.8cqw] px-[3cqw] pb-[2cqw] pt-[2.5cqw]">
      <BarraSuperior live={live} />

      <div className="flex min-h-0 flex-1 items-stretch gap-[2.5cqw]">
        <div className="flex flex-1 flex-col justify-center rounded-[2cqw] bg-crema p-[3cqw] text-profundo shadow-2xl">
          <ContenidoItem item={live.item} />
        </div>

        <div className="flex w-[16cqw] shrink-0 flex-col items-center justify-center gap-[1.5cqw]">
          {cerrado ? (
            <p className="rotate-[-4deg] rounded-[1cqw] bg-naranja px-[1.2cqw] py-[1cqw] text-center font-titulo text-[2.2cqw] font-bold leading-tight shadow-lg">
              Respuestas cerradas
            </p>
          ) : (
            <TemporizadorCircular temporizador={temporizador} />
          )}
          <p className="text-center font-titulo text-[2.2cqw] font-semibold">
            <span className="text-[3.4cqw] text-amarillo">{live.answers_count}</span> de {live.teams_count}
          </p>
        </div>
      </div>

      <TableroParticipacion live={live} />
    </div>
  )
}
