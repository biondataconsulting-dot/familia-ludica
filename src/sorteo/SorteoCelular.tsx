import { useEffect, useMemo, useState } from 'react'
import type { Live } from '../lib/tipos'
import { desfaseDe, momentoDe } from './estado'
import { useSorteo } from './useSorteo'

/** Celular durante el sorteo: qué premio se sortea, "girando…" y quién ganó (sin la ruleta). */
export function SorteoCelular({ live }: { live: Live }) {
  const sorteo = useSorteo(live.event.code, live)
  const desfase = useMemo(() => (sorteo ? desfaseDe(sorteo) : 0), [sorteo])
  const [ahora, setAhora] = useState(() => Date.now())
  useEffect(() => {
    const id = window.setInterval(() => setAhora(Date.now()), 500)
    return () => clearInterval(id)
  }, [])

  const titulo = live.block?.title ?? 'Sorteo'
  if (!sorteo) return <Centro emoji="🎡" titulo={titulo} texto="Miren el proyector: ¡se sortean premios!" />
  const m = momentoDe(sorteo, ahora + desfase)
  const u = sorteo.ultimo

  switch (m.tipo) {
    case 'espera':
      return <Centro emoji="🎡" titulo={titulo} texto={m.premio ? `Se sortea: ${m.premio.nombre}` : 'Miren el proyector: en un momento empieza.'} />
    case 'girando':
      return <Centro emoji="🎡" titulo="Girando la ruleta…" texto={m.premio ? `Premio: ${m.premio.nombre}` : ''} />
    case 'ausente':
      return <Centro emoji="🙈" titulo={`${u?.nombre} no está`} texto="Se vuelve a sortear el premio. ¡Miren el proyector!" />
    case 'ganador':
      return (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
          <p className="text-6xl" aria-hidden>
            🎉
          </p>
          <p className="text-lg font-bold text-profundo/70">¡Ganó!</p>
          <h1 className="text-4xl font-bold">{u?.nombre}</h1>
          {u?.dato && <p className="text-xl font-bold text-profundo/70">{u.dato}</p>}
          {m.premio && <p className="text-lg">Se lleva: {m.premio.nombre}</p>}
        </div>
      )
    case 'fin':
      return (
        <div className="flex flex-1 flex-col items-center justify-center gap-3">
          <p className="text-5xl" aria-hidden>
            🏆
          </p>
          <h1 className="text-center text-3xl font-bold">Ganadores</h1>
          <ol className="flex w-full flex-col gap-2">
            {sorteo.premios.map((p) => (
              <li key={p.id} className="rounded-xl bg-white px-4 py-2 shadow-sm">
                <p className="text-sm text-profundo/70">{p.nombre}</p>
                <p className="text-lg font-bold">
                  {p.ganador?.nombre} {p.ganador?.dato && <span className="text-base text-profundo/60">· {p.ganador.dato}</span>}
                </p>
              </li>
            ))}
          </ol>
        </div>
      )
  }
}

function Centro({ emoji, titulo, texto }: { emoji: string; titulo: string; texto: string }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
      <p className="text-6xl" aria-hidden>
        {emoji}
      </p>
      <h1 className="text-3xl font-bold">{titulo}</h1>
      <p className="text-lg text-profundo/80">{texto}</p>
    </div>
  )
}
