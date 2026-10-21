import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { Logo } from '../components/Logo'
import { DesafioMesa, MisionesMesa } from '../extras/ExtrasMesa'
import { useExtras } from '../extras/useExtras'
import { PhoneLayout } from '../layouts/PhoneLayout'
import { useLive } from '../live/useLive'
import { AvisoPuntos } from '../phone/AvisoPuntos'
import { EnJuego } from '../phone/EnJuego'
import { RankingMesa } from '../phone/RankingMesa'
import { Registro } from '../phone/Registro'
import { Reingreso } from '../phone/Reingreso'
import { useMiMesa } from '../phone/useMiMesa'
import { useWakeLock } from '../phone/useWakeLock'

/** Celular de mesa: registro o reingreso, y después los controles de cada fase. */
export default function Jugar() {
  const { codigo = '' } = useParams()
  const { live, error, desfaseMs } = useLive(codigo)
  const { mesa, entrar } = useMiMesa(codigo)
  // Módulo opcional (misiones y desafíos): con la noche sin módulo no consulta nada.
  const extras = useExtras(codigo, live, mesa?.token ?? null)
  const [reingresando, setReingresando] = useState(false)
  useWakeLock(Boolean(mesa))

  if (!live) {
    return (
      <PhoneLayout mesa={mesa?.name} pin={mesa?.pin}>
        <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
          <Logo className="w-40 shadow-md" />
          {error ? (
            <>
              <h1 className="text-2xl font-bold">
                {error.codigo === 'P0002' ? 'No encontramos esta noche' : 'No podemos conectarnos'}
              </h1>
              <p className="text-profundo/80">{error.message}</p>
            </>
          ) : (
            <p className="text-profundo/70">Cargando la noche…</p>
          )}
        </div>
      </PhoneLayout>
    )
  }

  return (
    <PhoneLayout mesa={mesa?.name} pin={mesa?.pin} dinamica={mesa ? live.block?.title : undefined} reconectando={Boolean(error)}>
      {mesa ? (
        <>
          <AvisoPuntos aviso={live.aviso} desfaseMs={desfaseMs} />
          {live.show_ranking && live.phase !== 'item_open' && live.phase !== 'final' && <RankingMesa live={live} teamId={mesa.team_id} />}
          {extras?.desafio && <DesafioMesa desafio={extras.desafio} />}
          <EnJuego live={live} mesa={mesa} />
          {extras && extras.misiones.length > 0 && <MisionesMesa misiones={extras.misiones} />}
        </>
      ) : reingresando ? (
        <Reingreso codigo={live.event.code} mesas={live.teams} onEntrar={entrar} onVolver={() => setReingresando(false)} />
      ) : (
        <Registro evento={live.event} onEntrar={entrar} onReingreso={() => setReingresando(true)} />
      )}
    </PhoneLayout>
  )
}
