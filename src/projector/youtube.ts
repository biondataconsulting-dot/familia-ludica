/** Carga única de la YouTube IFrame Player API (https://www.youtube.com/iframe_api), con tipos mínimos. */

export type ReproductorYT = {
  loadVideoById(opciones: { videoId: string; startSeconds?: number }): void
  cueVideoById(opciones: { videoId: string; startSeconds?: number }): void
  seekTo(segundos: number, permitirBuscar: boolean): void
  playVideo(): void
  pauseVideo(): void
  getCurrentTime(): number
  getPlayerState(): number
  setVolume(volumen: number): void
  unMute(): void
  isMuted(): boolean
  mute(): void
  getDuration(): number
  destroy(): void
}

export type EventosYT = {
  onReady?: (e: { target: ReproductorYT }) => void
  onStateChange?: (e: { data: number; target: ReproductorYT }) => void
  onError?: (e: { data: number }) => void
}

type APIYouTube = {
  Player: new (
    elemento: HTMLElement,
    opciones: { width?: number; height?: number; videoId?: string; playerVars?: Record<string, number | string>; events?: EventosYT },
  ) => ReproductorYT
}

declare global {
  interface Window {
    YT?: APIYouTube
    onYouTubeIframeAPIReady?: () => void
  }
}

/**
 * ¿El navegador bloqueó el sonido? Sí si suena silenciado, o si el video ni arrancó y nadie tocó la
 * pantalla. Una pausa (la pone la app), un video que carga o uno que suena con volumen: no.
 */
export function sonidoBloqueado(estado: number, silenciado: boolean, huboToque: boolean): boolean {
  if (estado === ESTADO_YT.REPRODUCIENDO) return silenciado
  if (estado === ESTADO_YT.SIN_EMPEZAR || estado === ESTADO_YT.EN_COLA) return !huboToque
  return false
}

export const ESTADO_YT = { SIN_EMPEZAR: -1, TERMINADO: 0, REPRODUCIENDO: 1, PAUSADO: 2, CARGANDO: 3, LISTO: 5, EN_COLA: 5 } as const

let cargando: Promise<APIYouTube> | null = null

export function cargarYouTube(): Promise<APIYouTube> {
  if (window.YT?.Player) return Promise.resolve(window.YT)
  if (!cargando) {
    cargando = new Promise((resolver, rechazar) => {
      const anterior = window.onYouTubeIframeAPIReady
      window.onYouTubeIframeAPIReady = () => {
        anterior?.()
        if (window.YT) resolver(window.YT)
      }
      const script = document.createElement('script')
      script.src = 'https://www.youtube.com/iframe_api'
      script.async = true
      script.onerror = () => {
        cargando = null
        rechazar(new Error('No se pudo cargar el reproductor de YouTube.'))
      }
      document.head.appendChild(script)
    })
  }
  return cargando
}
