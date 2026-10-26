import { useEffect, useMemo, useState } from 'react'
import type { Live } from '../lib/tipos'
import { FORMATO } from './formato'
import { ReproductorBingo } from './ReproductorBingo'
import type { BingoPublico } from './rpc'
import { useBingo } from './useBingo'

/**
 * Proyector, bloque «Bingo musical». Mientras suena el estribillo, una bolilla «?» (ni número ni título: el
 * número está en el cartón y la gente tiene que reconocer la canción); al revelarse (fin del fragmento o
 * «Revelar ya»), el número, el título y el artista. A la derecha, el tablero con los números revelados y las
 * últimas canciones con nombre.
 */
export function BingoProyector({ live, conSonido, senalRepetir }: { live: Live; conSonido: boolean; senalRepetir: number }) {
  const bingo = useBingo(live.event.code, live)
  const ultima = bingo?.bolillas.at(-1)
  return (
    <>
      {conSonido && (
        <ReproductorBingo
          codigo={live.event.code}
          bolillaId={ultima ? `${ultima.position}|${ultima.at}` : null}
          senalRepetir={senalRepetir}
          extendida={ultima?.extendida ?? false}
          cortada={ultima?.cortada ?? false}
        />
      )}
      {bingo ? <Tablero live={live} bingo={bingo} /> : <Encabezado live={live} grande />}
    </>
  )
}

function Encabezado({ live, grande = false, tipo }: { live: Live; grande?: boolean; tipo?: BingoPublico['tipo'] }) {
  return (
    <div className={`flex items-center gap-[1.2cqw] ${grande ? 'h-full justify-center' : ''}`}>
      {live.block?.emoji && <span className={grande ? 'text-[7cqw]' : 'text-[3.4cqw]'}>{live.block.emoji}</span>}
      <h1 className={`font-titulo font-bold leading-none ${grande ? 'text-[6.5cqw]' : 'text-[3.4cqw]'}`}>{live.block?.title}</h1>
      {tipo && (
        <span className="rounded-full bg-naranja px-[1.4cqw] py-[0.4cqw] text-[1.6cqw] font-bold uppercase tracking-[0.1em]">
          {FORMATO[tipo].nombre} · cartones {FORMATO[tipo].letra}
        </span>
      )}
    </div>
  )
}

function Tablero({ live, bingo }: { live: Live; bingo: BingoPublico }) {
  const desfase = useMemo(() => Date.parse(bingo.server_now) - Date.now(), [bingo])
  const [ahora, setAhora] = useState(() => Date.now())
  useEffect(() => {
    const id = window.setInterval(() => setAhora(Date.now()), 250)
    return () => window.clearInterval(id)
  }, [])

  const ultima = bingo.bolillas.at(-1)
  const sonando = ultima
    ? !ultima.cortada && (ultima.extendida || ahora + desfase < Date.parse(ultima.at) + ultima.duracion * 1000)
    : false
  const salieron = new Set(bingo.bolillas.map((b) => b.number))
  const ultimoNumero = ultima?.number ?? null
  // Las últimas con nombre (en el Full, con el tablero de 90, entran 3).
  const conNombre = bingo.bolillas.filter((b) => b.titulo).slice(bingo.tipo === 'express' ? -4 : -3).reverse()
  const f = FORMATO[bingo.tipo]
  const columnas = bingo.tipo === 'express' ? 8 : 10

  return (
    <div className="grid h-full grid-cols-[40cqw_1fr] gap-[3cqw] px-[4cqw] pb-[2.5cqw] pt-[3cqw]">
      <div className="flex min-h-0 flex-col gap-[2cqw]">
        <Encabezado live={live} tipo={bingo.tipo} />
        <div className="flex flex-1 flex-col items-center justify-center gap-[1.5cqw] text-center">
          {!ultima ? (
            <>
              <p className="font-titulo text-[4cqw] font-bold leading-tight">¡Preparen sus cartones {f.letra}!</p>
              <p className="text-[2cqw] text-white/85">Suena el estribillo: cantalo, buscalo en tu cartón y marcalo.</p>
              <p className="text-[1.8cqw] font-semibold text-white/75">Línea: una fila completa · Bingo: el cartón lleno</p>
            </>
          ) : (
            <>
              <div
                key={`${ultima.position}-${ultima.revelada}`}
                className={`motion-safe:animate-aparecer flex h-[22cqw] w-[22cqw] items-center justify-center rounded-full font-titulo text-[11cqw] font-bold shadow-2xl ring-[1.2cqw] ring-naranja ${
                  ultima.revelada ? 'bg-white text-profundo' : 'bg-naranja text-white'
                }`}
              >
                {ultima.revelada ? ultima.number : '?'}
              </div>
              {ultima.revelada ? (
                <div className="motion-safe:animate-aparecer flex flex-col items-center gap-[0.8cqw]">
                  {sonando && <Ecualizador />}
                  <p className="font-titulo text-[3.6cqw] font-bold leading-tight">{ultima.titulo}</p>
                  <p className="text-[2.2cqw] font-semibold text-white/85">{ultima.artista}</p>
                </div>
              ) : (
                <>
                  {sonando && <Ecualizador />}
                  <p className="font-titulo text-[3cqw] font-bold">¡A cantar! ¿Qué canción es?</p>
                </>
              )}
            </>
          )}
        </div>
      </div>

      <div className="debajo-del-logo flex min-h-0 flex-col gap-[1.5cqw]">
        <p className="text-[1.6cqw] font-bold uppercase tracking-[0.15em] text-white/80">
          Salieron {bingo.bolillas.length} de {bingo.pool}
        </p>
        <div className="grid gap-[0.45cqw]" style={{ gridTemplateColumns: `repeat(${columnas}, 1fr)` }}>
          {Array.from({ length: bingo.pool }, (_, i) => i + 1).map((n) => {
            const es = n === ultimoNumero
            const salio = salieron.has(n)
            return (
              <span
                key={n}
                className={`flex items-center justify-center rounded-[0.5cqw] font-titulo font-bold tabular-nums ${
                  bingo.tipo === 'express' ? 'h-[4cqw] text-[2cqw]' : 'h-[2.5cqw] text-[1.35cqw]'
                } ${es ? 'bg-naranja text-white ring-[0.3cqw] ring-white' : salio ? 'bg-white text-profundo' : 'bg-white/10 text-white/35'}`}
              >
                {n}
              </span>
            )
          })}
        </div>
        {conNombre.length > 0 && (
          <ol className="flex flex-col gap-[0.5cqw]">
            {conNombre.map((b) => (
              <li key={b.number} className="flex items-center gap-[1cqw] rounded-[0.8cqw] bg-white px-[1.2cqw] py-[0.5cqw] text-profundo">
                <span className="w-[3cqw] font-titulo text-[1.8cqw] font-bold">{b.number}</span>
                <span className="min-w-0 flex-1 truncate text-[1.6cqw] font-bold">{b.titulo}</span>
                <span className="max-w-[40%] truncate text-[1.3cqw] font-semibold text-profundo/60">{b.artista}</span>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  )
}

function Ecualizador() {
  return (
    <div className="flex h-[4cqw] items-end gap-[0.5cqw]" aria-hidden>
      {[0, 1, 2, 3, 4, 5, 6].map((i) => (
        <span key={i} className="h-full w-[0.9cqw] origin-bottom animate-ecualizador rounded-full bg-celeste" style={{ animationDelay: `${i * 0.12}s` }} />
      ))}
    </div>
  )
}
