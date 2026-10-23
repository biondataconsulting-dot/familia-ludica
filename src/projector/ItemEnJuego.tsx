import type { Temporizador } from '../live/useTemporizador'
import { DecoBloque } from './DecoBloque'
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
        <div className="relative flex flex-1 flex-col justify-center rounded-[2cqw] bg-crema p-[3cqw] text-profundo shadow-2xl">
          <DecoBloque emoji={live.block?.emoji} />
          <ContenidoItem dinamica={live.block?.dynamic} item={live.item} />
        </div>

        {/* Columna derecha: arranca debajo del logo de la esquina. */}
        <div className="debajo-del-logo flex w-[16cqw] shrink-0 flex-col items-center justify-center gap-[1.2cqw]">
          {cerrado ? (
            <p className="rotate-[-4deg] rounded-[1cqw] bg-naranja px-[1.2cqw] py-[1cqw] text-center font-titulo text-[2.2cqw] font-bold leading-tight shadow-lg">
              Respuestas cerradas
            </p>
          ) : (
            <div className="w-[13cqw]">
              <TemporizadorCircular temporizador={temporizador} />
            </div>
          )}
          <p className="text-center font-titulo font-semibold leading-tight">
            <span className="block text-[1.7cqw] uppercase tracking-wide text-white/85">Respondieron</span>
            <span className="text-[2.2cqw]">
              <span className="text-[3.4cqw] text-white">{live.answers_count}</span> de {live.teams_count}{' '}
              {live.teams_count === 1 ? 'mesa' : 'mesas'}
            </span>
          </p>
        </div>
      </div>

      <TableroParticipacion live={live} />
    </div>
  )
}
