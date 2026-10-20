import type { ReactNode } from 'react'
import { dinamicaDe, metaDe } from '../dynamics/registro'
import { formatearNumero } from '../dynamics/solucion'
import type { Live, MiMesa, Revelado } from '../lib/tipos'
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
      return (
        <Centro titulo={live.block?.title ?? ''} sello={practica}>
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
      return mio.points > 0 ? (
        <Centro emoji="🎉" titulo="¡Correcta!" sello={practica}>
          <span className="font-titulo text-4xl font-bold text-naranja">
            {verbo} +{formatearNumero(mio.points)}
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
