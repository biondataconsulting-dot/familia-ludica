import { useEffect, useMemo, useRef, useState } from 'react'
import type { Live } from '../lib/tipos'
import { Confeti } from './Confeti'
import { desfaseDe, momentoDe, type Momento } from './estado'
import { modulo, posicionEn, recorrido } from './giro'
import { golpeMadera } from './madera'
import { Rueda } from './Rueda'
import type { Persona, SorteoPublico } from './rpc'
import { useSorteo } from './useSorteo'

/** Ángulo entre renglones del tambor (radianes) y renglones dibujados a cada lado del centro. */
const PASO = 0.34
const A_CADA_LADO = 5
/** Hasta esta cantidad de participantes, rueda de la fortuna (un nombre por porción); con más, tambor. */
const RUEDA_HASTA = 30
/** Vueltas completas mínimas de la rueda en cada tirada. */
const VUELTAS_RUEDA = 3
/** Con la ruleta quieta (antes del primer sorteo), gira despacito: renglones por segundo. */
const VUELTA_LENTA = 0.6

const sinMovimiento = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

/** Proyector, bloque del sorteo: la ruleta de madera, el premio en juego y el ganador. */
export function SorteoProyector({ live, conSonido }: { live: Live; conSonido: boolean }) {
  const sorteo = useSorteo(live.event.code, live)
  if (!sorteo) return <Titulo live={live} />
  return <Sorteo live={live} sorteo={sorteo} conSonido={conSonido} />
}

function Titulo({ live, chico = false }: { live: Live; chico?: boolean }) {
  return (
    <div className={`flex items-center justify-center gap-[1.5cqw] ${chico ? '' : 'h-full'}`}>
      {live.block?.emoji && <span className={chico ? 'text-[3.5cqw]' : 'text-[7cqw]'}>{live.block.emoji}</span>}
      <h1 className={`font-titulo font-bold leading-none ${chico ? 'text-[3.5cqw]' : 'text-[6.5cqw]'}`}>{live.block?.title}</h1>
    </div>
  )
}

function Sorteo({ live, sorteo, conSonido }: { live: Live; sorteo: SorteoPublico; conSonido: boolean }) {
  const desfase = useMemo(() => desfaseDe(sorteo), [sorteo])
  const [ahora, setAhora] = useState(() => Date.now())
  const momento = momentoDe(sorteo, ahora + desfase)
  const quieto = sinMovimiento()

  // La lista de la ruleta se congela en cada tirada: si se suma alguien mientras gira, no salta.
  const congelada = useRef<{ id: string | null; rueda: Persona[] }>({ id: null, rueda: sorteo.rueda })
  const idTirada = sorteo.ultimo?.id ?? null
  if (congelada.current.id !== idTirada || !idTirada) congelada.current = { id: idTirada, rueda: sorteo.rueda }
  const rueda = congelada.current.rueda
  // Se decide por el total cargado (no por los que quedan): no cambia de rueda a tambor en medio del sorteo.
  const conRueda = sorteo.participantes <= RUEDA_HASTA

  // Animación: cuadro a cuadro mientras gira (o con la vuelta lenta); si no, unas veces por segundo.
  const animando = momento.tipo === 'girando' || (momento.tipo === 'espera' && !quieto)
  useEffect(() => {
    let id = 0
    const pedir = () => {
      setAhora(Date.now())
      id = animando ? requestAnimationFrame(pedir) : window.setTimeout(pedir, 250)
    }
    pedir()
    return () => {
      cancelAnimationFrame(id)
      clearTimeout(id)
    }
  }, [animando])

  let posicion = 0
  if (momento.tipo === 'espera') posicion = quieto ? 0 : ((ahora / 1000) * VUELTA_LENTA) % Math.max(rueda.length, 1)
  else if (momento.tipo !== 'fin' && sorteo.ultimo) {
    const destino = Math.max(0, rueda.findIndex((p) => p.id === sorteo.ultimo!.participante_id))
    const d = recorrido(rueda.length, destino, sorteo.ultimo.id, conRueda ? VUELTAS_RUEDA : 0)
    posicion = momento.tipo === 'girando' && !quieto ? posicionEn(momento.t, sorteo.giro_segundos, d) : d
  }

  useTic(posicion, momento, conSonido)

  if (momento.tipo === 'fin') return <Ganadores live={live} sorteo={sorteo} />
  const ganador = momento.tipo === 'ganador' ? sorteo.ultimo : null
  const proximo = sorteo.premios.find((p) => !p.ganador)

  return (
    <div className="relative grid h-full grid-cols-[38cqw_1fr] items-center gap-[4cqw] px-[6cqw] pb-[2cqw] pt-[7cqw]">
      <div className="flex flex-col items-start gap-[1.5cqw]">
        <Titulo live={live} chico />
        {momento.premio ? (
          <>
            <p className="rounded-full bg-naranja px-[1.6cqw] py-[0.4cqw] text-[1.8cqw] font-bold uppercase tracking-[0.15em]">
              Premio {momento.numero} de {sorteo.premios.length}
            </p>
            <h2 className="font-titulo text-[4.5cqw] font-bold leading-tight">{momento.premio.nombre}</h2>
            {momento.premio.imagen && (
              <img
                src={momento.premio.imagen}
                alt=""
                draggable={false}
                className="max-h-[18cqw] w-auto max-w-[34cqw] rounded-[1.2cqw] bg-white object-contain p-[0.5cqw] shadow-2xl"
              />
            )}
          </>
        ) : (
          <p className="text-[2.4cqw] text-white/85">En un momento empezamos el sorteo.</p>
        )}
        {momento.tipo === 'girando' && <p className="animate-pulse font-titulo text-[2.6cqw] font-semibold">Girando…</p>}
        {momento.tipo === 'ausente' && sorteo.ultimo && (
          <p className="rounded-[1cqw] bg-white/15 px-[1.5cqw] py-[1cqw] text-[2.3cqw] font-semibold leading-snug">
            {sorteo.ultimo.nombre} no está. <br />
            Volvemos a sortear este premio.
          </p>
        )}
      </div>
      {conRueda ? (
        <Rueda rueda={rueda} posicion={posicion} tachado={momento.tipo === 'ausente'} />
      ) : (
        <Tambor rueda={rueda} posicion={posicion} tachado={momento.tipo === 'ausente'} />
      )}

      {ganador && (
        <div key={ganador.id} className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-[1.5cqw] bg-azul/85 px-[8cqw] text-center">
          <Confeti />
          <p className="font-titulo text-[4cqw] font-bold">🎉 ¡Ganó!</p>
          <div className="animate-aparecer rounded-carta bg-crema px-[5cqw] py-[2.5cqw] text-profundo shadow-2xl">
            <p className="font-titulo text-[7.5cqw] font-bold leading-none">{ganador.nombre}</p>
            {ganador.dato && <p className="mt-[1cqw] text-[3cqw] font-bold text-profundo/70">{ganador.dato}</p>}
          </div>
          {momento.premio && (
            <p className="text-[2.8cqw] font-semibold">
              Se lleva: <span className="font-bold">{momento.premio.nombre}</span>
            </p>
          )}
          {proximo && <p className="mt-[1cqw] text-[1.8cqw] text-white/80">Próximo premio: {proximo.nombre}</p>}
        </div>
      )}
    </div>
  )
}

/** El tambor de madera visto de frente: el renglón del centro es el que marca la lengüeta. */
function Tambor({ rueda, posicion, tachado }: { rueda: Persona[]; posicion: number; tachado: boolean }) {
  const n = rueda.length
  const centro = Math.round(posicion)
  return (
    <div className="relative mx-auto aspect-[1.15] h-[37cqw] max-w-full rounded-[2cqw] bg-[#7a4a24] p-[1.2cqw] shadow-2xl">
      {/* Lamparitas de circo alrededor del marco. */}
      <div className="pointer-events-none absolute inset-[0.35cqw] rounded-[1.7cqw] border-[0.35cqw] border-dotted border-amarillo/80" aria-hidden />
      <div className="relative h-full overflow-hidden rounded-[1.2cqw] bg-crema">
        <div className="absolute inset-x-0 top-1/2 h-[5.6cqw] -translate-y-1/2 bg-naranja/15" aria-hidden />
        {n === 0 ? (
          <p className="absolute inset-0 flex items-center justify-center text-[2.4cqw] font-semibold text-profundo/60">Sin participantes</p>
        ) : (
          Array.from({ length: A_CADA_LADO * 2 + 1 }, (_, k) => {
            const renglon = Math.floor(posicion) - A_CADA_LADO + k
            const a = (renglon - posicion) * PASO
            if (Math.abs(a) >= Math.PI / 2) return null
            const p = rueda[modulo(renglon, n)]!
            const enCentro = renglon === centro && Math.abs(renglon - posicion) < 0.5
            return (
              <div
                key={renglon}
                className="absolute inset-x-0 top-1/2 flex h-[5.6cqw] items-center justify-center gap-[1cqw] px-[2cqw] text-profundo"
                style={{
                  transform: `translateY(calc(-50% + ${Math.sin(a) * 15.5}cqw)) scaleY(${Math.cos(a)})`,
                  opacity: 0.2 + 0.8 * Math.cos(a),
                }}
              >
                <span className={`truncate font-titulo text-[3.4cqw] font-bold ${enCentro && tachado ? 'line-through opacity-50' : ''}`}>{p.nombre}</span>
                {p.dato && <span className="shrink-0 text-[2cqw] font-bold text-profundo/55">{p.dato}</span>}
              </div>
            )
          })
        )}
        {/* Sombras de arriba y abajo: el tambor se curva. */}
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_bottom,rgba(23,63,99,0.55),transparent_30%,transparent_70%,rgba(23,63,99,0.55))]" aria-hidden />
      </div>
      {/* Lengüetas que marcan el ganador. */}
      <span className="absolute -left-[2.2cqw] top-1/2 -translate-y-1/2 border-y-[1.6cqw] border-l-[2.4cqw] border-y-transparent border-l-naranja drop-shadow-lg" aria-hidden />
      <span className="absolute -right-[2.2cqw] top-1/2 -translate-y-1/2 border-y-[1.6cqw] border-r-[2.4cqw] border-y-transparent border-r-naranja drop-shadow-lg" aria-hidden />
    </div>
  )
}

function Ganadores({ live, sorteo }: { live: Live; sorteo: SorteoPublico }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-[2cqw] px-[8cqw] pt-[3cqw]">
      <Titulo live={live} chico />
      <p className="font-titulo text-[3cqw] font-semibold">¡Felicitaciones a los ganadores!</p>
      <ol className="flex w-full max-w-[70cqw] flex-col gap-[0.8cqw]">
        {sorteo.premios.map((p) => (
          <li key={p.id} className="flex items-center gap-[1.5cqw] rounded-[1cqw] bg-white px-[2cqw] py-[0.9cqw] text-profundo shadow-lg">
            <span className="min-w-0 flex-1 truncate text-[2.2cqw] font-semibold text-profundo/70">{p.nombre}</span>
            <span className="truncate font-titulo text-[2.8cqw] font-bold">{p.ganador?.nombre}</span>
            {p.ganador?.dato && <span className="shrink-0 text-[1.8cqw] font-bold text-profundo/55">{p.ganador.dato}</span>}
          </li>
        ))}
      </ol>
    </div>
  )
}

/** Un "clac" de madera por cada nombre que pasa por la lengüeta, y uno grave al frenar. */
function useTic(posicion: number, momento: Momento, conSonido: boolean) {
  const anterior = useRef<{ renglon: number; tipo: Momento['tipo'] }>({ renglon: Math.round(posicion), tipo: momento.tipo })
  const ultimoTic = useRef(0)
  useEffect(() => {
    const renglon = Math.round(posicion)
    const antes = anterior.current
    anterior.current = { renglon, tipo: momento.tipo }
    if (!conSonido) return
    if (antes.tipo === 'girando' && (momento.tipo === 'ganador' || momento.tipo === 'ausente')) return golpeMadera(true)
    if (momento.tipo !== 'girando' || renglon === antes.renglon) return
    // A toda velocidad, como mucho ~25 golpes por segundo (si no, es un zumbido).
    const ahora = performance.now()
    if (ahora - ultimoTic.current < 40) return
    ultimoTic.current = ahora
    golpeMadera()
  }, [posicion, momento.tipo, conSonido])
}
