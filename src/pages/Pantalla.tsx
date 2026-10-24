import { useCierreAutomatico } from '../live/useCierreAutomatico'
import { useEffect, useState } from 'react'
import { cargarYouTube } from '../projector/youtube'
import { useParams } from 'react-router-dom'
import { useWakeLock } from '../phone/useWakeLock'
import { FranjaDesafio } from '../extras/FranjaDesafio'
import { useExtras } from '../extras/useExtras'
import { ComenzarNoche } from '../projector/ComenzarNoche'
import { ProjectorLayout } from '../layouts/ProjectorLayout'
import { useLive } from '../live/useLive'
import { useTemporizador } from '../live/useTemporizador'
import type { Live } from '../lib/tipos'
import { IntroBloque } from '../projector/IntroBloque'
import { ItemEnJuego } from '../projector/ItemEnJuego'
import { Podio } from '../projector/Podio'
import { Portada } from '../projector/Portada'
import { QrEsquina } from '../projector/QrEsquina'
import { SonidoProyector } from '../projector/SonidoProyector'
import { useLatidoProyector } from '../projector/useLatidoProyector'
import { RankingBloque } from '../projector/RankingBloque'
import { ReproductorOculto } from '../projector/ReproductorOculto'
import { Revelado } from '../projector/Revelado'
import { SorteoProyector } from '../sorteo/SorteoProyector'
import { BingoProyector } from '../bingo/BingoProyector'
import type { Temporizador } from '../live/useTemporizador'

/** Alto de la capa de contenido con la franja del desafío abajo (100% menos ALTO_FRANJA). */
const ALTO_SIN_FRANJA = 'h-[calc(100%-6.5cqw)]'

/** Proyector: la pantalla protagonista. Muestra lo que corresponde a la fase actual. */
export default function Pantalla() {
  const { codigo = '' } = useParams()
  const { live, error, desfaseMs, senalRepetir } = useLive(codigo)
  const temporizador = useTemporizador(live, desfaseMs)
  // Al llegar a 0 se cierran las respuestas solas (la base confirma que el tiempo se cumplió).
  useCierreAutomatico(codigo, live, temporizador)
  // "Comenzar la noche": un toque por carga de página (el navegador olvida el permiso de sonido al recargar).
  const [comenzada, setComenzada] = useState(false)
  useWakeLock(comenzada)
  // Para que el panel avise si hay dos proyectores con sonido (se escucharía doble).
  useLatidoProyector(codigo, comenzada)
  // La API de YouTube se baja de entrada (en segundo plano) para no sumarla a la primera canción.
  useEffect(() => {
    void cargarYouTube().catch(() => undefined)
  }, [])
  // Módulo opcional: el desafío lanzado va en una franja abajo (no en el podio).
  const extras = useExtras(codigo, live)
  const desafio = live?.phase !== 'final' ? extras?.desafio : null
  const portada = !comenzada && <ComenzarNoche nombre={live?.event.name} onComenzar={() => setComenzada(true)} />
  // El player de Hitster y Cine se prepara desde la presentación del bloque (así no demora la primera canción).
  const conMedia =
    live != null &&
    ['hipster', 'cine'].includes(live.block?.dynamic ?? '') &&
    ['block_intro', 'item_open', 'item_closed', 'item_revealed'].includes(live.phase)

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
              <p className="text-[1.5cqw] text-white/75">Seguimos intentando solos.</p>
            </>
          ) : (
            <p className="font-titulo text-[3cqw] font-semibold text-white/80">Preparando la noche…</p>
          )}
        </div>
        {portada}
      </ProjectorLayout>
    )
  }

  return (
    <ProjectorLayout logoEsquina={live.phase !== 'cover'}>
      {conMedia && <ReproductorOculto codigo={codigo} live={live} senalRepetir={senalRepetir} />}
      {/* Música o sonido del conductor (solo con «Comenzar la noche» tocado: sin eso el navegador no deja sonar). */}
      {comenzada && <SonidoProyector codigo={codigo} live={live} />}
      {/* Capa de contenido por encima del player oculto (más baja si hay un desafío en la franja). */}
      <div className={`relative z-10 ${desafio ? ALTO_SIN_FRANJA : 'h-full'}`}>
        <Fase live={live} temporizador={temporizador} conSonido={comenzada} senalRepetir={senalRepetir} />
      </div>
      {desafio && <FranjaDesafio desafio={desafio} />}
      {/* Botón "Mostrar QR" del conductor (en la portada el QR ya está). */}
      {live.show_qr && live.phase !== 'cover' && <QrEsquina codigo={live.event.code} />}
      {error && (
        <p className="absolute bottom-[0.8cqw] left-[1cqw] rounded-full bg-naranja/90 px-[1cqw] py-[0.2cqw] text-[1cqw] font-bold">
          Reconectando…
        </p>
      )}
      {portada}
    </ProjectorLayout>
  )
}

function Fase(props: { live: Live; temporizador: Temporizador; conSonido: boolean; senalRepetir: number }) {
  const { live, temporizador, conSonido, senalRepetir } = props
  // Botón "Cómo va la noche" del conductor (nunca con una pregunta abierta ni en el podio).
  if (live.show_ranking && live.phase !== 'item_open' && live.phase !== 'final') return <RankingBloque live={live} enCualquierMomento />
  // Botón "Podio" del conductor: el podio sin terminar la noche (por ejemplo, antes del sorteo).
  if (live.show_podio && live.phase !== 'item_open' && live.phase !== 'final') return <Podio live={live} enCualquierMomento />
  switch (live.phase) {
    case 'cover':
      return <Portada live={live} />
    case 'block_intro':
      if (live.block?.dynamic === 'sorteo') return <SorteoProyector live={live} conSonido={conSonido} />
      if (live.block?.dynamic === 'bingo') return <BingoProyector live={live} conSonido={conSonido} senalRepetir={senalRepetir} />
      return <IntroBloque live={live} />
    case 'item_open':
    case 'item_closed':
      return <ItemEnJuego live={live} temporizador={temporizador} />
    case 'item_revealed':
      return <Revelado live={live} />
    case 'block_ranking':
      return <RankingBloque live={live} />
    case 'final':
      return <Podio live={live} />
  }
}
