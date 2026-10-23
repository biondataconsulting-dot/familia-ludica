import type { ReactNode } from 'react'
import { dinamicaDe, metaDe } from '../dynamics/registro'
import { formatearNumero } from '../dynamics/solucion'
import type { Live, MiMesa, Revelado } from '../lib/tipos'
import { SorteoCelular } from '../sorteo/SorteoCelular'
import { Responder } from './Responder'
import { useMiRespuesta } from './useMiRespuesta'

/** Lo que ve la mesa ya registrada, según la fase. */
export function EnJuego({ live, mesa }: { live: Live; mesa: MiMesa }) {
  const meta = metaDe(live.block?.dynamic)
  const dinamica = dinamicaDe(live.block?.dynamic)
  const practica = live.block?.is_practice ?? false
  const { respuesta, registrar } = useMiRespuesta(mesa.token, live.item?.block_item_id)
  // Respaldo: si la base dice que respondimos pero todavía no leímos qué, igual mostramos "enviada".
  const yaRespondio = live.answered.includes(mesa.team_id)

  switch (live.phase) {
    case 'cover':
      return (
        <Centro emoji="🎲" titulo="¡Listos!">
          Miren el proyector: la noche arranca en un ratito.
        </Centro>
      )

    case 'block_intro':
      if (live.block?.dynamic === 'sorteo') return <SorteoCelular live={live} />
      if (live.block?.dynamic === 'especial') {
        return (
          <Centro emoji={live.block.emoji ?? '✨'} titulo={live.block.title}>
            {live.block.subtitulo || 'Miren el proyector.'}
          </Centro>
        )
      }
      return (
        <Centro emoji={live.block?.emoji ?? undefined} titulo={live.block?.title ?? ''} sello={practica}>
          {meta.comoSeJuega}
        </Centro>
      )

    case 'item_open':
      if (!dinamica || !live.item) {
        return (
          <Centro titulo="Miren el proyector" sello={practica}>
            Esta dinámica todavía no se responde desde el celular.
          </Centro>
        )
      }
      return (
        <>
          {practica && <Sello />}
          <Responder
            key={live.item.block_item_id}
            live={live}
            mesa={mesa}
            dinamica={dinamica}
            enviada={respuesta ?? (yaRespondio ? {} : null)}
            onEnviada={(r) => registrar(live.item!.block_item_id, r)}
          />
        </>
      )

    case 'item_closed':
      return (
        <Centro emoji="✋" titulo="Respuestas cerradas" sello={practica}>
          {respuesta && dinamica && live.item ? (
            <>
              Mandaron: <span className="font-bold">{dinamica.describir(live.item.content, respuesta)}</span>
            </>
          ) : yaRespondio ? (
            'Su respuesta quedó registrada.'
          ) : (
            'Esta vez no llegaron a responder.'
          )}
        </Centro>
      )

    case 'item_revealed': {
      const revelado = live.revealed as Revelado | null
      const mio = revelado?.points.find((p) => p.team_id === mesa.team_id)
      const verbo = revelado?.practice ? 'Hubieran sumado' : 'Sumaron'
      if (!mio) {
        return (
          <Centro emoji="⏱️" titulo="No respondieron" sello={practica}>
            Miren la respuesta en el proyector. ¡En la próxima!
          </Centro>
        )
      }
      const detalle = (mio.detail ?? {}) as { correcta?: boolean; mas_cerca?: boolean }
      const propio = dinamica?.resultado?.(detalle as Record<string, unknown>, mio.points)
      const titulo = propio?.titulo ?? (detalle.mas_cerca ? '¡La más cerca!' : detalle.correcta ? '¡Correcta!' : '¡Bien cerca!')
      return mio.points > 0 ? (
        <Centro emoji="🎉" titulo={titulo} sello={practica}>
          <span className="font-titulo text-4xl font-bold text-naranja">
            {verbo} +{formatearNumero(mio.points)}
          </span>
          {propio?.lineas.map((l) => (
            <span key={l} className="mt-1 block text-base">
              {l}
            </span>
          ))}
        </Centro>
      ) : (
        <Centro emoji="🙃" titulo="Esta vez no" sello={practica}>
          Miren la respuesta en el proyector. ¡En la próxima!
        </Centro>
      )
    }

    case 'block_ranking':
      return <TablaRanking live={live} mesa={mesa} />

    case 'final': {
      const mia = live.ranking.find((r) => r.team_id === mesa.team_id)
      return (
        <Centro emoji={mia?.position === 1 ? '🏆' : '💛'} titulo="¡Gracias por jugar!">
          {mia && (
            <span className="mb-2 block">
              Terminaron en el <span className="font-titulo text-4xl font-bold text-naranja">{mia.position}°</span> puesto de{' '}
              {live.ranking.length}, con <span className="font-bold">{formatearNumero(mia.total)}</span> puntos.
            </span>
          )}
          Nos vemos en la próxima.
          <a
            href="https://www.instagram.com/familia.ludica/"
            target="_blank"
            rel="noopener noreferrer"
            className="mx-auto mt-5 flex min-h-toque w-full max-w-xs items-center justify-center gap-2 rounded-carta bg-naranja px-5 py-3 font-titulo text-lg font-semibold text-white shadow-md"
          >
            📸 Seguinos en Instagram
          </a>
          <span className="mt-1 block text-sm font-bold">@familia.ludica</span>
        </Centro>
      )
    }
  }
}

/** Ranking completo con la mesa propia resaltada. */
function TablaRanking({ live, mesa }: { live: Live; mesa: MiMesa }) {
  return (
    <div className="flex flex-1 flex-col gap-3">
      <div className="text-center">
        <h1 className="text-3xl font-bold">Así va la noche</h1>
        {live.block && <p className="text-profundo/70">Después de {live.block.title}</p>}
      </div>
      <ol className="flex flex-col gap-1.5">
        {live.ranking.map((r) => {
          const propia = r.team_id === mesa.team_id
          return (
            <li
              key={r.team_id}
              aria-current={propia ? 'true' : undefined}
              className={`flex items-center gap-3 rounded-xl px-3 py-2 ${
                propia ? 'bg-naranja font-bold text-white shadow-md' : r.position === 1 ? 'bg-amarillo font-bold' : 'bg-white'
              }`}
            >
              <span className="w-6 text-center font-titulo text-lg">{r.position}</span>
              <span className="min-w-0 flex-1 truncate">{r.name}</span>
              <span className="font-titulo tabular-nums">{formatearNumero(r.total)}</span>
            </li>
          )
        })}
      </ol>
    </div>
  )
}

function Sello() {
  return (
    <p className="mb-3 self-center rounded-lg bg-naranja px-3 py-1 text-xs font-extrabold uppercase tracking-wide text-white">
      Ronda de práctica · no suma puntos
    </p>
  )
}

function Centro({ emoji, titulo, sello = false, children }: { emoji?: string; titulo: string; sello?: boolean; children: ReactNode }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
      {sello && <Sello />}
      {emoji && (
        <p className="text-6xl" aria-hidden>
          {emoji}
        </p>
      )}
      <h1 className="text-3xl font-bold">{titulo}</h1>
      <p className="text-lg text-profundo/80">{children}</p>
    </div>
  )
}
