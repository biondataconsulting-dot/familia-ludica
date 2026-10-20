import { cargarYouTube, ESTADO_YT, type ReproductorYT } from '../projector/youtube'

export type ResultadoVideo = {
  estado: 'ok' | 'aviso' | 'error'
  mensaje: string
  duracionVideo?: number
}

const ERRORES: Record<number, string> = {
  2: 'El id del video no es válido.',
  5: 'El reproductor no pudo abrir el video.',
  100: 'El video no existe o es privado.',
  // YouTube usa los mismos códigos para "no se puede insertar" y para videos que no están disponibles.
  101: 'YouTube no deja reproducirlo acá (el dueño no permite insertarlo o el video no está disponible): no va a sonar en el proyector.',
  150: 'YouTube no deja reproducirlo acá (el dueño no permite insertarlo o el video no está disponible): no va a sonar en el proyector.',
}

const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`
const ESPERA_MS = 15_000

/**
 * Prueba un video como lo va a usar el proyector: crea un player (silenciado) en `contenedor`,
 * intenta reproducir desde `inicio` y espera a que suene o a que YouTube devuelva un error.
 */
export async function revisarVideo(contenedor: HTMLElement, youtubeId: string, inicio: number, duracion: number): Promise<ResultadoVideo> {
  const YT = await cargarYouTube()
  return new Promise((resolver) => {
    const nodo = document.createElement('div')
    contenedor.replaceChildren(nodo)
    let terminado = false
    let player: ReproductorYT | null = null
    const terminar = (r: ResultadoVideo) => {
      if (terminado) return
      terminado = true
      window.clearTimeout(espera)
      try {
        player?.destroy()
      } catch {
        /* ya destruido */
      }
      resolver(r)
    }
    const espera = window.setTimeout(
      () => terminar({ estado: 'aviso', mensaje: 'No respondió en 15 s. Probalo de nuevo o escuchalo desde el catálogo.' }),
      ESPERA_MS,
    )
    player = new YT.Player(nodo, {
      width: 320,
      height: 180,
      videoId: youtubeId,
      playerVars: { autoplay: 1, mute: 1, start: inicio, controls: 0, playsinline: 1, rel: 0 },
      events: {
        onReady: (e) => {
          e.target.mute()
          e.target.playVideo()
        },
        onStateChange: (e) => {
          if (e.data !== ESTADO_YT.REPRODUCIENDO) return
          const dur = e.target.getDuration()
          if (dur && inicio + duracion > dur) {
            terminar({ estado: 'aviso', duracionVideo: dur, mensaje: `Se puede insertar, pero el fragmento pasa el final del video (dura ${mmss(dur)}).` })
          } else {
            terminar({ estado: 'ok', duracionVideo: dur, mensaje: 'Se puede insertar y suena.' })
          }
        },
        onError: (e) => terminar({ estado: 'error', mensaje: ERRORES[e.data] ?? `YouTube devolvió el error ${e.data}.` }),
      },
    })
  })
}
