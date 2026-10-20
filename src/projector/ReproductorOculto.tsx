import { useCallback, useEffect, useRef, useState } from 'react'
import { proyectorMedia, type MediaProyector } from '../lib/rpc'
import type { Live } from '../lib/tipos'
import { cargarYouTube, ESTADO_YT, type ReproductorYT } from './youtube'

type Props = { codigo: string; live: Live; senalRepetir: number }

/** Solo en desarrollo: línea de tiempo del audio para medir demoras (window.__flAudio). */
function marcar(evento: string) {
  if (!import.meta.env.DEV) return
  const w = window as unknown as { __flAudio?: { evento: string; ms: number }[] }
  ;(w.__flAudio ??= []).push({ evento, ms: Math.round(performance.now()) })
}

/**
 * Player de YouTube detrás de la tarjeta del proyector (nunca se ve: la tarjeta lo tapa).
 * Se monta desde la presentación de un bloque de Hipster, así el player ya está listo cuando se abre
 * la primera canción (al abrir solo falta cargar el video). Suena solo al abrir el ítem, se corta al
 * cumplir la duración, se pausa al cerrar y vuelve a sonar con "Repetir". Si el navegador bloquea el
 * sonido, ofrece un botón para activarlo.
 */
export function ReproductorOculto({ codigo, live, senalRepetir }: Props) {
  const contenedor = useRef<HTMLDivElement>(null)
  /** Player listo para usar (después de onReady). */
  const player = useRef<ReproductorYT | null>(null)
  /** Player creado (aunque todavía no esté listo), para poder destruirlo al desmontar. */
  const creado = useRef<ReproductorYT | null>(null)
  const listo = useRef<Promise<ReproductorYT> | null>(null)
  /** Video cargado en el player (para que "Repetir" salte al inicio en vez de recargarlo). */
  const cargado = useRef<string | null>(null)
  const [media, setMedia] = useState<MediaProyector | null>(null)
  const [bloqueado, setBloqueado] = useState(false)
  const [falla, setFalla] = useState<string | null>(null)
  const esMedia = ['pista_audio', 'clip_video'].includes(live.item?.type ?? '')
  const itemId = esMedia ? live.item?.block_item_id : undefined
  const fase = live.phase

  // Un único player para todo el bloque, creado apenas se monta (sin video).
  const obtenerPlayer = useCallback(() => {
    if (!listo.current) {
      listo.current = cargarYouTube().then(
        (YT) =>
          new Promise<ReproductorYT>((resolver) => {
            const nodo = document.createElement('div')
            contenedor.current?.appendChild(nodo)
            const p = new YT.Player(nodo, {
              width: 320,
              height: 180,
              playerVars: { autoplay: 0, controls: 0, disablekb: 1, fs: 0, iv_load_policy: 3, modestbranding: 1, playsinline: 1, rel: 0 },
              events: {
                // Los métodos del player existen recién acá: antes, getPlayerState y compañía no están.
                onReady: () => {
                  player.current = p
                  marcar('player listo')
                  resolver(p)
                },
                onStateChange: (e) => {
                  if (e.data === ESTADO_YT.REPRODUCIENDO) marcar('suena')
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

  useEffect(() => {
    void obtenerPlayer()
  }, [obtenerPlayer])

  // El youtube_id llega solo por proyector_media (nunca por get_live), y solo con el ítem en juego.
  useEffect(() => {
    if (!itemId) return
    marcar('ítem visto')
    let activo = true
    proyectorMedia(codigo)
      .then((m) => {
        if (activo && m?.block_item_id === itemId) {
          marcar('video recibido')
          setMedia(m)
        }
      })
      .catch(() => activo && setFalla('No se pudo leer el video.'))
    return () => {
      activo = false
    }
  }, [codigo, itemId])

  const reproducir = useCallback(
    async (m: MediaProyector) => {
      const p = await obtenerPlayer()
      setFalla(null)
      if (cargado.current === m.youtube_id) {
        p.seekTo(m.inicio, true)
        p.playVideo()
      } else {
        cargado.current = m.youtube_id
        p.loadVideoById({ videoId: m.youtube_id, startSeconds: m.inicio })
      }
      p.unMute()
      p.setVolume(100)
      // Si a los 4 s no está sonando ni cargando, el navegador bloqueó el audio (falta un toque en la pantalla).
      window.setTimeout(() => {
        const estado = player.current?.getPlayerState()
        if (estado !== ESTADO_YT.REPRODUCIENDO && estado !== ESTADO_YT.CARGANDO) setBloqueado(true)
      }, 4000)
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
      if (media && media.block_item_id === itemId) void reproducir(media)
    }
  }, [senalRepetir, media, itemId, reproducir])

  // Cerrar respuestas o salir del ítem: se detiene el audio.
  useEffect(() => {
    if (fase === 'item_closed' || fase === 'block_intro') player.current?.pauseVideo()
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
      {/* Detrás de la tarjeta central: la capa de contenido (z-10) lo tapa por completo. En la
          presentación del bloque no hay tarjeta: ahí queda invisible (todavía no suena nada). */}
      <div
        ref={contenedor}
        aria-hidden
        className={`pointer-events-none absolute left-[12cqw] top-[18cqw] z-0 h-[180px] w-[320px] overflow-hidden ${itemId ? '' : 'opacity-0'}`}
      />
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
