import { useEffect, useState } from 'react'
import type { Live } from '../lib/tipos'
import { getBingo, type BingoPublico } from './rpc'

/** true mientras se juega el bingo (presentación de un bloque «Bingo musical»). */
export const enBingo = (live: Live | null) => live?.block?.dynamic === 'bingo' && live.phase === 'block_intro'

/**
 * Bingo para proyector y celulares: solo se consulta durante el bloque del bingo. Se relee cada vez que
 * useLive relee (aviso en tiempo real o cada 5 s) y, mientras suena una canción, al terminar su fragmento
 * (para mostrar el título enseguida). Si una lectura falla, queda lo último leído.
 */
export function useBingo(codigo: string, live: Live | null): BingoPublico | null {
  const activo = enBingo(live)
  const [bingo, setBingo] = useState<BingoPublico | null>(null)
  const [vuelta, setVuelta] = useState(0)
  const pulso = live?.server_now

  useEffect(() => {
    if (!activo) {
      setBingo(null)
      return
    }
    let vigente = true
    getBingo(codigo)
      .then((x) => vigente && setBingo(x))
      .catch(() => undefined)
    return () => {
      vigente = false
    }
  }, [activo, codigo, pulso, vuelta])

  // Releer apenas termina el fragmento de la última bolilla (ahí la base ya manda el título).
  const ultima = bingo?.bolillas.at(-1)
  useEffect(() => {
    if (!bingo || !ultima || ultima.titulo) return
    const desfase = Date.parse(bingo.server_now) - Date.now()
    const falta = Date.parse(ultima.at) + ultima.duracion * 1000 - (Date.now() + desfase)
    const id = window.setTimeout(() => setVuelta((n) => n + 1), Math.max(300, falta + 300))
    return () => window.clearTimeout(id)
  }, [bingo, ultima])

  return activo ? bingo : null
}
