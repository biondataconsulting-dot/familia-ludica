import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react'
import { proyectorMedia, proyectorMediaArranco, type MediaProyector } from '../lib/rpc'
import type { Live } from '../lib/tipos'
import { cargarYouTube, ESTADO_YT, type ReproductorYT } from './youtube'

type Props = { codigo: string; live: Live; senalRepetir: number }

/** Solo en desarrollo: línea de tiempo del audio para medir demoras (window.__flAudio). */
function marcar(evento: string) {
  if (!import.meta.env.DEV) return
  const w = window as unknown as { __flAudio?: { evento: string; ms: number }[] }
  ;(w.__flAudio ??= []).push({ evento, ms: Math.round(performance.now()) })
}

/** Lugar del marco de video ([data-marco-video] de Cine y series) relativo al escenario, en px. */
/** Tiempo con las franjas puestas después de que arranca la escena (YouTube muestra el título al empezar). */
const TELON_MS = 4000

/** preparando/fin: cortina completa · telon: franjas arriba y abajo · abierto: escena entera. */
type Cortina = 'preparando' | 'telon' | 'abierto' | 'fin'

type Marco = { left: number; top: number; width: number; height: number }

function medirMarco(escenario: HTMLElement | null): Marco | null {
  const marco = escenario?.querySelector<HTMLElement>('[data-marco-video]')
  if (!escenario || !marco) return null
  const e = escenario.getBoundingClientRect()
  const m = marco.getBoundingClientRect()
  if (m.width === 0) return null
  return { left: m.left - e.left, top: m.top - e.top, width: m.width, height: m.height }
}

/**
 * Player de YouTube del proyector. En Hipster queda detrás de la tarjeta (nunca se ve: la tarjeta lo tapa).
 * En Cine y series se ubica encima del marco de video de la tarjeta mientras se responde, agrandado y
 * recortado para que no se vean el título ni el logo de YouTube.
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
  const esCine = live.block?.dynamic === 'cine'
  const exterior = useRef<HTMLDivElement>(null)
  const [marco, setMarco] = useState<Marco | null>(null)
  const videoVisible = esCine && !!itemId && (fase === 'item_open' || fase === 'item_closed')
  // Telón sobre la escena: YouTube muestra título, "Más videos" y su logo al cargar, al arrancar y en
  // pausa. Antes de arrancar y en pausa, cortina completa. Al arrancar, imagen y sonido juntos con dos
  // franjas tapando los bordes (donde YouTube pone título y logo), que después se abren como un telón.
  const [cortina, setCortina] = useState<Cortina>('preparando')
  const seVio = useRef(false)
  const demoraCortina = useRef<number | undefined>(undefined)
  // Para el aviso de arranque (el handler del player se crea una sola vez).
  const enJuego = useRef({ codigo, itemId, fase })
  enJuego.current = { codigo, itemId, fase }
  const avisados = useRef(new Set<string>())
  const alCambiarEstado = useCallback((estado: number) => {
    window.clearTimeout(demoraCortina.current)
    if (estado === ESTADO_YT.REPRODUCIENDO) {
      // El cronómetro corre desde que arranca, no desde que se abrió (la base lo acepta una vez).
      const j = enJuego.current
      if (j.fase === 'item_open' && j.itemId && !avisados.current.has(j.itemId)) {
        avisados.current.add(j.itemId)
        void proyectorMediaArranco(j.codigo, j.itemId).catch(() => undefined)
      }
      setCortina((c) => (c === 'abierto' ? c : 'telon'))
      demoraCortina.current = window.setTimeout(() => {
        seVio.current = true
        setCortina('abierto')
      }, TELON_MS)
    } else if (estado !== ESTADO_YT.CARGANDO || !seVio.current) {
      setCortina(seVio.current ? 'fin' : 'preparando')
    }
  }, [])
  useEffect(() => {
    seVio.current = false
    setCortina('preparando')
  }, [itemId])
  useEffect(() => () => window.clearTimeout(demoraCortina.current), [])

  // El marco lo dibuja la tarjeta (otra capa): se mide al cambiar de fase y se sigue midiendo por si
  // cambia el tamaño de la ventana o la tarjeta termina de acomodarse.
  useEffect(() => {
    if (!videoVisible) {
      setMarco(null)
      return
    }
    const escenario = exterior.current?.offsetParent as HTMLElement | null
    const actualizar = () =>
      setMarco((previo) => {
        const nuevo = medirMarco(escenario)
        const igual =
          previo && nuevo && ['left', 'top', 'width', 'height'].every((k) => Math.abs(previo[k as keyof Marco] - nuevo[k as keyof Marco]) < 0.5)
        return igual ? previo : nuevo
      })
    actualizar()
    const id = window.setInterval(actualizar, 300)
    window.addEventListener('resize', actualizar)
    return () => {
      window.clearInterval(id)
      window.removeEventListener('resize', actualizar)
    }
  }, [videoVisible, itemId])

  // Un único player para todo el bloque, creado apenas se monta (sin video).
  // Cada montaje tiene su número: si la pantalla se desmonta mientras YouTube carga, el player que
  // llega tarde se descarta (si no, quedaba un player suelto además del nuevo).
  const montaje = useRef(0)
  const obtenerPlayer = useCallback(() => {
    if (!listo.current) {
      const mio = montaje.current
      listo.current = cargarYouTube().then(
        (YT) =>
          new Promise<ReproductorYT>((resolver) => {
            if (mio !== montaje.current) return
            const nodo = document.createElement('div')
            contenedor.current?.appendChild(nodo)
            const p = new YT.Player(nodo, {
              width: 320,
              height: 180,
              playerVars: { autoplay: 0, controls: 0, disablekb: 1, fs: 0, iv_load_policy: 3, modestbranding: 1, playsinline: 1, rel: 0 },
              events: {
                // Los métodos del player existen recién acá: antes, getPlayerState y compañía no están.
                onReady: () => {
                  if (mio !== montaje.current) {
                    p.destroy()
                    return
                  }
                  player.current = p
                  marcar('player listo')
                  resolver(p)
                },
                onStateChange: (e) => {
                  if (e.data === ESTADO_YT.REPRODUCIENDO) marcar('suena')
                  alCambiarEstado(e.data)
                },
                onError: (e) => setFalla(`Este video no se puede reproducir acá (error ${e.data}).`),
              },
            })
            creado.current = p
          }),
      )
    }
    return listo.current
  }, [alCambiarEstado])

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

  // Cerrar respuestas o salir del ítem: se detiene el audio (en Cine, también al revelar: el video deja de verse).
  useEffect(() => {
    if (fase === 'item_closed' || fase === 'block_intro' || (esCine && fase === 'item_revealed')) player.current?.pauseVideo()
  }, [fase, esCine])

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
      montaje.current += 1
      creado.current?.destroy()
      creado.current = null
      player.current = null
      listo.current = null
    },
    [],
  )

  const estiloCine: CSSProperties | undefined = videoVisible && marco ? { ...marco } : undefined
  return (
    <>
      {/* Hipster: detrás de la tarjeta central (la capa de contenido, z-10, lo tapa por completo).
          Cine: encima del marco de la tarjeta (z-20), sin poder tocarlo, agrandado 35% dentro de un
          recorte para esconder la barra de título y el logo de YouTube. Fuera del ítem, invisible. */}
      <div
        ref={exterior}
        aria-hidden
        style={estiloCine}
        className={
          estiloCine
            ? 'pointer-events-none absolute z-20 overflow-hidden rounded-[1cqw] bg-black'
            : `pointer-events-none absolute left-[12cqw] top-[18cqw] z-0 h-[180px] w-[320px] overflow-hidden ${itemId && !esCine ? '' : 'opacity-0'}`
        }
      >
        <div ref={contenedor} className={`absolute inset-0 [&_iframe]:h-full [&_iframe]:w-full ${estiloCine ? 'scale-[1.35]' : ''}`} />
        {estiloCine && (
          <>
            {/* Franjas del telón (20% arriba y abajo): al abrirse, una sube y la otra baja en 1 s. */}
            {(['top-0 origin-top', 'bottom-0 origin-bottom'] as const).map((lado, i) => (
              <div
                key={lado}
                className={`absolute inset-x-0 h-[20%] bg-profundo ${lado} ${
                  cortina === 'abierto'
                    ? `${i === 0 ? '-translate-y-full' : 'translate-y-full'} transition-transform duration-1000 ease-in-out motion-reduce:transition-none`
                    : ''
                }`}
              />
            ))}
            {(cortina === 'preparando' || cortina === 'fin') && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-[0.8cqw] bg-profundo text-white">
                <span className="text-[5cqw] leading-none">🎬</span>
                <span className="font-titulo text-[2.2cqw] font-semibold">{cortina === 'fin' ? 'Fin de la escena' : 'Preparando la escena…'}</span>
              </div>
            )}
          </>
        )}
      </div>
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
