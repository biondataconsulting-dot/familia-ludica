import { useEffect, useRef } from 'react'
import { cargarYouTube, ESTADO_YT, type ReproductorYT } from '../projector/youtube'
import { proyectorBingo } from './rpc'

const VOLUMEN = 90
const ENTRADA_MS = 900
const SALIDA_MS = 900

/** Solo en desarrollo: estados del reproductor (window.__flBingo), para diagnosticar. */
function marcar(evento: string) {
  if (!import.meta.env.DEV) return
  const w = window as unknown as { __flBingo?: { evento: string; ms: number }[] }
  ;(w.__flBingo ??= []).push({ evento, ms: Math.round(performance.now()) })
}

/**
 * Proyector: el estribillo de la última bolilla, con un player de YouTube propio e invisible. Arranca con
 * entrada suave y se corta al cumplir la duración. Si el proyector se recarga a mitad de la canción, sigue
 * desde donde va; si ya terminó, no suena. «Repetir» (señal del conductor) la vuelve a pasar entera.
 * «Dejar sonando» (extendida) saca el corte: sigue hasta que el conductor la corta («Cortar»: salida suave).
 */
type Props = { codigo: string; bolillaId: string | null; senalRepetir: number; extendida: boolean; cortada: boolean }

export function ReproductorBingo({ codigo, bolillaId, senalRepetir, extendida, cortada }: Props) {
  const contenedor = useRef<HTMLDivElement>(null)
  const player = useRef<ReproductorYT | null>(null)
  const listo = useRef<Promise<ReproductorYT> | null>(null)
  const fin = useRef<number | null>(null)
  const rampa = useRef<number | undefined>(undefined)
  const repetirInicial = useRef(senalRepetir)
  // La canción se cortó sola al cumplir la duración (si después la extienden, sigue desde ahí).
  const cortoPorDuracion = useRef(false)

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
                onStateChange: (e) => marcar(`estado ${e.data}`),
                onError: (e) => marcar(`error ${e.data}`),
              },
            })
          }),
      )
    }
    return listo.current
  }

  const volumen = (p: ReproductorYT, desde: number, hasta: number, ms: number, alTerminar?: () => void) => {
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

  const tocar = async (entera: boolean) => {
    const m = await proyectorBingo(codigo).catch(() => null)
    if (!m) return
    // Lo que ya pasó de la canción. El aviso llega 1–2 s tarde: eso no se saltea (el estribillo arranca entero);
    // solo si el proyector se recargó a mitad de la canción, sigue desde donde va.
    const transcurrido = (Date.now() - Date.parse(m.at)) / 1000
    const pasado = entera || transcurrido < 4 ? 0 : transcurrido
    if (m.cortada && !entera) return
    if (pasado >= m.duracion && !m.extendida) return
    const p = await obtener()
    marcar(`suena (${m.youtube_id} desde ${Math.round(m.inicio + pasado)} s)`)
    fin.current = m.extendida ? null : m.inicio + m.duracion
    cortoPorDuracion.current = false
    p.unMute()
    p.setVolume(0)
    p.loadVideoById({ videoId: m.youtube_id, startSeconds: m.inicio + pasado })
    volumen(p, 0, VOLUMEN, ENTRADA_MS)
  }

  // Bolilla nueva: suena.
  useEffect(() => {
    if (bolillaId) void tocar(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bolillaId])

  // «Repetir» del conductor: la misma canción, desde el estribillo.
  useEffect(() => {
    if (senalRepetir !== repetirInicial.current && bolillaId) void tocar(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [senalRepetir])

  // «Dejar sonando»: sin corte; si ya se había cortado por duración, sigue desde ahí.
  useEffect(() => {
    if (!extendida || cortada) return
    fin.current = null
    const p = player.current
    if (p && cortoPorDuracion.current) {
      cortoPorDuracion.current = false
      marcar('sigue sonando')
      p.playVideo()
      volumen(p, 0, VOLUMEN, ENTRADA_MS)
    }
  }, [extendida, cortada, bolillaId])

  // «Cortar» del conductor: salida suave.
  useEffect(() => {
    if (!cortada) return
    fin.current = null
    const p = player.current
    if (!p || p.getPlayerState() !== ESTADO_YT.REPRODUCIENDO) return
    marcar('cortada por el conductor')
    volumen(p, VOLUMEN, 0, SALIDA_MS, () => p.pauseVideo())
  }, [cortada, bolillaId])

  // Corte al cumplir la duración.
  useEffect(() => {
    const id = window.setInterval(() => {
      const p = player.current
      if (!p || fin.current == null || p.getPlayerState() !== ESTADO_YT.REPRODUCIENDO || p.getCurrentTime() < fin.current) return
      fin.current = null
      cortoPorDuracion.current = true
      marcar('corte por duración')
      volumen(p, VOLUMEN, 0, SALIDA_MS, () => p.pauseVideo())
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
