import { useParams } from 'react-router-dom'
import { ProjectorLayout } from '../layouts/ProjectorLayout'
import { useLive } from '../live/useLive'
import { useTemporizador } from '../live/useTemporizador'
import type { Live } from '../lib/tipos'
import { IntroBloque } from '../projector/IntroBloque'
import { ItemEnJuego } from '../projector/ItemEnJuego'
import { Portada } from '../projector/Portada'
import { Revelado } from '../projector/Revelado'
import type { Temporizador } from '../live/useTemporizador'

/** Proyector: la pantalla protagonista. Muestra lo que corresponde a la fase actual. */
export default function Pantalla() {
  const { codigo = '' } = useParams()
  const { live, error, desfaseMs } = useLive(codigo)
  const temporizador = useTemporizador(live, desfaseMs)

  if (!live) {
    return (
      <ProjectorLayout>
        <div className="flex h-full flex-col items-center justify-center gap-[1.5cqw] px-[8cqw] text-center">
          {error ? (
            <>
              <h1 className="font-titulo text-[4cqw] font-bold text-white">
                {error.codigo === 'P0002' ? 'No encontramos esta noche' : 'No podemos conectarnos'}
              </h1>
              <p className="text-[2cqw] text-white/90">{error.message}</p>
              <p className="text-[1.5cqw] text-white/60">Seguimos intentando solos.</p>
            </>
          ) : (
            <p className="font-titulo text-[3cqw] font-semibold text-white/80">Preparando la noche…</p>
          )}
        </div>
      </ProjectorLayout>
    )
  }

  return (
    <ProjectorLayout logoEsquina={live.phase !== 'cover'}>
      <Fase live={live} temporizador={temporizador} />
      {error && (
        <p className="absolute bottom-[0.8cqw] left-[1cqw] rounded-full bg-naranja/90 px-[1cqw] py-[0.2cqw] text-[1cqw] font-bold">
          Reconectando…
        </p>
      )}
    </ProjectorLayout>
  )
}

function Fase({ live, temporizador }: { live: Live; temporizador: Temporizador }) {
  switch (live.phase) {
    case 'cover':
      return <Portada live={live} />
    case 'block_intro':
      return <IntroBloque live={live} />
    case 'item_open':
    case 'item_closed':
      return <ItemEnJuego live={live} temporizador={temporizador} />
    case 'item_revealed':
      return <Revelado live={live} />
    case 'block_ranking':
      // Ranking completo: paso 8.
      return <Cartel titulo="Así va la noche" texto={live.block?.title ?? ''} />
    case 'final':
      // Podio: paso 8.
      return <Cartel titulo="¡Gracias por jugar!" texto="Nos vemos en la próxima · @familia.ludica" />
  }
}

function Cartel({ titulo, texto }: { titulo: string; texto: string }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-[2cqw] text-center">
      <h1 className="font-titulo text-[6cqw] font-bold text-white">{titulo}</h1>
      <p className="text-[2.4cqw] text-white/90">{texto}</p>
    </div>
  )
}
