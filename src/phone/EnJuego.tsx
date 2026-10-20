import type { ReactNode } from 'react'
import { metaDe } from '../dynamics/registro'
import { formatearNumero } from '../dynamics/solucion'
import type { Live, MiMesa, Revelado } from '../lib/tipos'

/** Lo que ve la mesa ya registrada, según la fase. El formulario de cada dinámica llega en el paso 6. */
export function EnJuego({ live, mesa }: { live: Live; mesa: MiMesa }) {
  const meta = metaDe(live.block?.dynamic)
  const practica = live.block?.is_practice ?? false

  switch (live.phase) {
    case 'cover':
      return (
        <Centro emoji="🎲" titulo="¡Listos!">
          Miren el proyector: la noche arranca en un ratito.
        </Centro>
      )

    case 'block_intro':
      return (
        <Centro titulo={live.block?.title ?? ''} sello={practica}>
          {meta.comoSeJuega}
        </Centro>
      )

    case 'item_open': {
      const yaRespondio = live.answered.includes(mesa.team_id)
      return (
        <Centro titulo={yaRespondio ? '¡Respuesta enviada!' : meta.instruccionCelular} sello={practica}>
          Miren la consigna en el proyector.
          <br />
          <span className="font-bold">
            Respondieron {live.answers_count} de {live.teams_count}
          </span>
        </Centro>
      )
    }

    case 'item_closed':
      return (
        <Centro emoji="✋" titulo="Respuestas cerradas" sello={practica}>
          En un ratito se revela la respuesta.
        </Centro>
      )

    case 'item_revealed': {
      const revelado = live.revealed as Revelado | null
      const puntos = revelado?.points.find((p) => p.team_id === mesa.team_id)?.points ?? 0
      const verbo = revelado?.practice ? 'Hubieran sumado' : 'Sumaron'
      return puntos > 0 ? (
        <Centro emoji="🎉" titulo="¡Bien ahí!" sello={practica}>
          <span className="font-titulo text-4xl font-bold text-naranja">
            {verbo} +{formatearNumero(puntos)}
          </span>
        </Centro>
      ) : (
        <Centro emoji="🙃" titulo="Esta vez no" sello={practica}>
          Miren la respuesta en el proyector. ¡En la próxima!
        </Centro>
      )
    }

    case 'block_ranking':
      return (
        <Centro emoji="🏆" titulo="Así va la noche">
          Miren el ranking en el proyector.
        </Centro>
      )

    case 'final':
      return (
        <Centro emoji="💛" titulo="¡Gracias por jugar!">
          Nos vemos en la próxima. Seguinos en @familia.ludica
        </Centro>
      )
  }
}

function Centro({ emoji, titulo, sello = false, children }: { emoji?: string; titulo: string; sello?: boolean; children: ReactNode }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
      {sello && (
        <p className="rounded-lg border-2 border-naranja px-3 py-1 text-xs font-extrabold uppercase tracking-wide text-naranja">
          Ronda de práctica · no suma puntos
        </p>
      )}
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
