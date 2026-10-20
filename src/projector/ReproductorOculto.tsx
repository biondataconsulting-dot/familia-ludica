import { useCallback, useEffect, useRef, useState } from 'react'
import { proyectorMedia, type MediaProyector } from '../lib/rpc'
import type { Live } from '../lib/tipos'
import { cargarYouTube, ESTADO_YT, type ReproductorYT } from './youtube'

type Props = { codigo: string; live: Live; senalRepetir: number }

/**
 * Player de YouTube detrás de la tarjeta del proyector (nunca se ve: la tarjeta lo tapa).
 * Suena solo al abrir el ítem, se corta al cumplir la duración, se pausa al cerrar y vuelve a
 * sonar con "Repetir" del conductor. Si el navegador bloquea el sonido, ofrece un botón para activarlo.
 */
export function ReproductorOculto({ codigo, live, senalRepetir }: Props) {
  const contenedor = useRef<HTMLDivElement>(null)
  /** Player listo para usar (después de onReady). */
  const player = useRef<ReproductorYT | null>(null)
  /** Player creado (aunque todavía no esté listo), para poder destruirlo al desmontar. */
  const creado = useRef<ReproductorYT | null>(null)
  const listo = useRef<Promise<ReproductorYT> | null>(null)
  const [media, setMedia] = useState<MediaProyector | null>(null)
  const [bloqueado, setBloqueado] = useState(false)
  const [falla, setFalla] = useState<string | null>(null)
  const itemId = live.item?.block_item_id
  const fase = live.phase

  // El youtube_id llega solo por proyector_media (nunca por get_live).
  useEffect(() => {
    if (!itemId) return
    let activo = true
    proyectorMedia(codigo)
      .then((m) => activo && m?.block_item_id === itemId && setMedia(m))
      .catch(() => activo && setFalla('No se pudo leer el video.'))
    return () => {
      activo = false
    }
  }, [codigo, itemId])

  // Un único player para toda la noche (se crea con el primer video).
  const obtenerPlayer = useCallback((m: MediaProyector) => {
    if (!listo.current) {
      listo.current = cargarYouTube().then(
        (YT) =>
          new Promise<ReproductorYT>((resolver) => {
            const nodo = document.createElement('div')
            contenedor.current?.appendChild(nodo)
            const p = new YT.Player(nodo, {
              width: 320,
              height: 180,
              videoId: m.youtube_id,
              playerVars: { autoplay: 0, controls: 0, disablekb: 1, fs: 0, iv_load_policy: 3, modestbranding: 1, playsinline: 1, rel: 0, start: m.inicio },
              events: {
                // Los métodos del player existen recién acá: antes, getPlayerState y compañía no están.
                onReady: () => {
                  player.current = p
                  resolver(p)
                },
                onError: (e) => setFalla(`Este video no se puede reproducir acá (error ${e.data}).`),
              },
            })
            creado.current = p
          }),
      )
    }
    return listo.current
  }, [])

  const reproducir = useCallback(
    async (m: MediaProyector) => {
      const p = await obtenerPlayer(m)
      setFalla(null)
      p.loadVideoById({ videoId: m.youtube_id, startSeconds: m.inicio })
      p.unMute()
      p.setVolume(100)
      // Si a los 2,5 s no está sonando, el navegador bloqueó el audio (falta un toque en la pantalla).
      window.setTimeout(() => {
        if (player.current?.getPlayerState() !== ESTADO_YT.REPRODUCIENDO) setBloqueado(true)
      }, 2500)
    },
    [obtenerPlayer],
  )

  // Abrir el ítem: suena una vez sola.
  const yaSono = useRef<string | null>(null)
  useEffect(() => {
    if (fase === 'item_open' && media && media.block_item_id === itemId && yaSono.current !== itemId) {
      yaSono.current = itemId
      void reproducir(media)
    }
  }, [fase, media, itemId, reproducir])

  // "Repetir" del conductor.
  const ultimaSenal = useRef(senalRepetir)
  useEffect(() => {
    if (senalRepetir !== ultimaSenal.current) {
      ultimaSenal.current = senalRepetir
      if (media) void reproducir(media)
    }
  }, [senalRepetir, media, reproducir])

  // Cerrar respuestas: se detiene el audio.
  useEffect(() => {
    if (fase === 'item_closed') player.current?.pauseVideo()
  }, [fase])

  // Corte al cumplir la duración del fragmento.
  useEffect(() => {
    if (!media) return
    const fin = media.inicio + media.duracion
    const id = window.setInterval(() => {
      const p = player.current
      if (p && p.getPlayerState() === ESTADO_YT.REPRODUCIENDO && p.getCurrentTime() >= fin) p.pauseVideo()
    }, 250)
    return () => window.clearInterval(id)
  }, [media])

  useEffect(
    () => () => {
      creado.current?.destroy()
      creado.current = null
      player.current = null
      listo.current = null
    },
    [],
  )

  return (
    <>
      {/* Detrás de la tarjeta central: la capa de contenido (z-10) lo tapa por completo. */}
      <div ref={contenedor} aria-hidden className="pointer-events-none absolute left-[12cqw] top-[18cqw] z-0 h-[180px] w-[320px] overflow-hidden" />
      {bloqueado && media && (
        <button
          onClick={() => {
            setBloqueado(false)
            void reproducir(media)
          }}
          className="absolute bottom-[2cqw] left-1/2 z-30 -translate-x-1/2 rounded-full bg-naranja px-[2.5cqw] py-[1cqw] font-titulo text-[2cqw] font-semibold text-white shadow-2xl"
        >
          🔈 Tocá acá para activar el sonido
        </button>
      )}
      {falla && (
        <p className="absolute bottom-[0.8cqw] right-[1cqw] z-30 rounded-full bg-profundo/80 px-[1cqw] py-[0.2cqw] text-[1cqw] text-white/80">
          {falla}
        </p>
      )}
    </>
  )
}
