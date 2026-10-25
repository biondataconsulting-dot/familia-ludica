import { useEffect, useMemo, useState } from 'react'
import type { Live } from '../lib/tipos'
import { FORMATO } from './formato'
import { useBingo } from './useBingo'

/** Celular durante el bingo: si está sonando una (sin número ni título) y la lista de las reveladas. */
export function BingoCelular({ live }: { live: Live }) {
  const bingo = useBingo(live.event.code, live)
  const desfase = useMemo(() => (bingo ? Date.parse(bingo.server_now) - Date.now() : 0), [bingo])
  const [ahora, setAhora] = useState(() => Date.now())
  useEffect(() => {
    const id = window.setInterval(() => setAhora(Date.now()), 500)
    return () => window.clearInterval(id)
  }, [])

  if (!bingo) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
        <p className="text-6xl" aria-hidden>
          🎵
        </p>
        <h1 className="text-3xl font-bold">{live.block?.title ?? 'Bingo musical'}</h1>
        <p className="text-lg text-profundo/80">Miren el proyector: ¡a cantar!</p>
      </div>
    )
  }
  const f = FORMATO[bingo.tipo]
  const ultima = bingo.bolillas.at(-1)
  const sonando = ultima ? !ultima.revelada && ahora + desfase < Date.parse(ultima.at) + ultima.duracion * 1000 : false
  const salieron = bingo.bolillas.filter((b) => b.titulo).reverse()

  return (
    <div className="flex flex-1 flex-col gap-3">
      <div className="text-center">
        <h1 className="text-2xl font-bold">🎵 {live.block?.title}</h1>
        <p className="text-sm font-semibold text-profundo/70">
          {f.nombre} · cartones {f.letra} · salieron {bingo.bolillas.length} de {bingo.pool}
        </p>
      </div>
      {sonando && ultima && (
        <div className="rounded-carta bg-naranja px-4 py-3 text-center text-white shadow-md">
          <p className="font-titulo text-4xl font-bold">?</p>
          <p className="font-semibold">Sonando… ¿qué canción es?</p>
        </div>
      )}
      {salieron.length === 0 && !sonando && <p className="text-center text-profundo/70">Cuando salga la primera canción, aparece acá.</p>}
      <ol className="flex flex-col gap-1.5">
        {salieron.map((b, i) => (
          <li key={b.number} className={`flex items-center gap-3 rounded-xl px-3 py-2 shadow-sm ${i === 0 && !sonando ? 'bg-profundo text-white' : 'bg-white'}`}>
            <span className="w-8 text-center font-titulo text-xl font-bold">{b.number}</span>
            <span className="min-w-0 flex-1">
              <span className="block truncate font-bold">{b.titulo}</span>
              <span className={`block truncate text-sm ${i === 0 && !sonando ? 'text-white/75' : 'text-profundo/60'}`}>{b.artista}</span>
            </span>
          </li>
        ))}
      </ol>
    </div>
  )
}
