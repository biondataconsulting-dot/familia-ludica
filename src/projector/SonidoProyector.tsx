import { useEffect, useRef } from 'react'
import { proyectorSonido } from '../lib/rpc'
import type { Live } from '../lib/tipos'
import { cargarYouTube, ESTADO_YT, type ReproductorYT } from './youtube'

const VOLUMEN = 85
const ENTRADA_MS = 1200
const SALIDA_MS = 700

/**
 * Música o sonido que el conductor prende a mano (música de fondo, redoblante…). Un player de YouTube
 * propio, invisible, aparte del del juego. Entra y sale con el volumen suave, se repite si el sonido lo pide
 * y se corta al cumplir su duración. Mientras está abierta una canción o escena del juego, no suena.
 */
export function SonidoProyector({ codigo, live }: { codigo: string; live: Live }) {
  const contenedor = useRef<HTMLDivElement>(null)
  const player = useRef<ReproductorYT | null>(null)
  const listo = useRef<Promise<ReproductorYT> | null>(null)
  const actual = useRef<{ clave: string; inicio: number; fin: number | null; repetir: boolean } | null>(null)
  const rampa = useRef<number | undefined>(undefined)

  const enJuegoMedia =
    ['hipster', 'cine'].includes(live.block?.dynamic ?? '') && (live.phase === 'item_open' || live.phase === 'item_closed')
  // Cada vez que se prende (aunque sea el mismo sonido) cambia "desde": vuelve a empezar.
  const clave = live.sonido && !enJuegoMedia ? `${live.sonido.id}|${live.sonido.desde}` : null

  const obtener = () => {
    if (!listo.current) {
      listo.current = cargarYouTube().then(
        (YT) =>
          new Promise<ReproductorYT>((resolver) => {
            const nodo = document.createElement('div')
            contenedor.current?.appendChild(nodo)
            const p = new YT.Player(nodo, {
              width: 200,
              height: 112,
              playerVars: { autoplay: 0, controls: 0, disablekb: 1, fs: 0, iv_load_policy: 3, playsinline: 1, rel: 0 },
              events: {
                onReady: () => {
                  player.current = p
                  resolver(p)
                },
                // Repetir en bucle: al terminar el video, vuelve al inicio.
                onStateChange: (e) => {
                  const a = actual.current
                  if (e.data === ESTADO_YT.TERMINADO && a?.repetir) {
                    p.seekTo(a.inicio, true)
                    p.playVideo()
                  }
                },
              },
            })
          }),
      )
    }
    return listo.current
  }

  const llevarVolumen = (p: ReproductorYT, desde: number, hasta: number, ms: number, alTerminar?: () => void) => {
    window.clearInterval(rampa.current)
    const pasos = Math.max(1, Math.round(ms / 80))
    let n = 0
    p.setVolume(desde)
    rampa.current = window.setInterval(() => {
      n++
      p.setVolume(desde + ((hasta - desde) * n) / pasos)
      if (n >= pasos) {
        window.clearInterval(rampa.current)
        alTerminar?.()
      }
    }, 80)
  }

  useEffect(() => {
    let vigente = true
    if (!clave) {
      // Apagar con salida suave.
      const p = player.current
      actual.current = null
      if (p && p.getPlayerState() === ESTADO_YT.REPRODUCIENDO) llevarVolumen(p, VOLUMEN, 0, SALIDA_MS, () => p.pauseVideo())
      return
    }
    void (async () => {
      const s = await proyectorSonido(codigo).catch(() => null)
      if (!vigente || !s) return
      const p = await obtener()
      if (!vigente) return
      actual.current = { clave, inicio: s.inicio, fin: s.duracion ? s.inicio + s.duracion : null, repetir: s.repetir }
      p.unMute()
      p.setVolume(0)
      p.loadVideoById({ videoId: s.youtube_id, startSeconds: s.inicio })
      llevarVolumen(p, 0, VOLUMEN, ENTRADA_MS)
    })()
    return () => {
      vigente = false
    }
  }, [clave, codigo])

  // Corte al cumplir la duración (o vuelta al inicio si se repite).
  useEffect(() => {
    const id = window.setInterval(() => {
      const p = player.current
      const a = actual.current
      if (!p || !a?.fin || p.getPlayerState() !== ESTADO_YT.REPRODUCIENDO || p.getCurrentTime() < a.fin) return
      if (a.repetir) p.seekTo(a.inicio, true)
      else llevarVolumen(p, VOLUMEN, 0, SALIDA_MS, () => p.pauseVideo())
    }, 250)
    return () => window.clearInterval(id)
     
  }, [])

  useEffect(
    () => () => {
      window.clearInterval(rampa.current)
      player.current?.destroy()
      player.current = null
      listo.current = null
    },
    [],
  )

  return <div ref={contenedor} aria-hidden className="pointer-events-none absolute left-0 top-0 h-[112px] w-[200px] overflow-hidden opacity-0" />
}
