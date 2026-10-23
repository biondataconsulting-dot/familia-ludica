import { useEffect, useState } from 'react'
import { ErrorRpc } from '../lib/rpc'
import type { Live } from '../lib/tipos'
import { AgregarParticipantes } from './ArmarSorteo'
import { sorteoAdmin } from './rpc'
import { useSorteoAdmin } from './useSorteo'

/** Igual que private.sorteo_giro_segundos(): lo que tarda la ruleta en frenar. */
const GIRO_S = 9

const mensajeDe = (e: unknown) => (e instanceof ErrorRpc ? e.message : 'Algo salió mal. Probá de nuevo.')

/** /admin/vivo/:id — el bloque del sorteo: sortear de a un premio, "no está" y ganadores. */
export function VivoSorteo({ eventId, live, desfaseMs }: { eventId: string; live: Live; desfaseMs: number }) {
  const { datos, error, recargar } = useSorteoAdmin(eventId, live.server_now)
  const [ocupado, setOcupado] = useState(false)
  const [falla, setFalla] = useState<string | null>(null)
  const [ahora, setAhora] = useState(() => Date.now())
  const [sumar, setSumar] = useState(false)

  const ultimo = datos?.sorteos.at(-1)
  const restante = ultimo ? GIRO_S - (ahora + desfaseMs - Date.parse(ultimo.created_at)) / 1000 : 0
  const girando = restante > 0
  useEffect(() => {
    if (!girando) return
    const id = window.setInterval(() => setAhora(Date.now()), 250)
    return () => clearInterval(id)
  }, [girando])

  if (error) return <p className="rounded-xl bg-naranja/15 px-4 py-2 text-sm font-semibold">{error}</p>
  if (!datos) return null

  const enBloque = live.phase === 'block_intro' && live.block?.dynamic === 'sorteo'
  const ganadores = new Map(datos.sorteos.filter((s) => s.estado === 'ganador').map((s) => [s.prize_id, s.participant_id]))
  const yaGanaron = new Set(ganadores.values())
  const quedan = datos.participantes.filter((p) => !p.ausente && !yaGanaron.has(p.id)).length
  const proximo = datos.premios.find((p) => !ganadores.has(p.id))
  const numero = proximo ? datos.premios.indexOf(proximo) + 1 : 0
  const persona = (id: string | undefined) => datos.participantes.find((p) => p.id === id)
  const salio = ultimo && !girando ? persona(ultimo.participant_id) : undefined
  const premioDe = (id: string | undefined) => datos.premios.find((p) => p.id === id)

  const ejecutar = async (accion: () => Promise<unknown>) => {
    setOcupado(true)
    setFalla(null)
    try {
      await accion()
      setAhora(Date.now())
      await recargar()
    } catch (e) {
      setFalla(mensajeDe(e))
    } finally {
      setOcupado(false)
    }
  }

  return (
    <section className="flex flex-col gap-3 rounded-carta border-4 border-naranja/40 bg-white p-4 shadow-md">
      <h2 className="text-lg font-bold">🎡 Sorteo</h2>
      {datos.premios.length === 0 ? (
        <p className="text-sm font-semibold">No hay premios cargados. Agregalos en Armar (tarjeta «Sorteo»).</p>
      ) : proximo ? (
        <>
          <p className="text-sm text-profundo/70">
            Premio {numero} de {datos.premios.length}: <span className="font-bold text-profundo">{proximo.nombre}</span> · {quedan}{' '}
            {quedan === 1 ? 'participante' : 'participantes'} en la ruleta
          </p>
          <button
            disabled={ocupado || girando || !enBloque || quedan === 0}
            onClick={() => void ejecutar(() => sorteoAdmin.sortear(eventId))}
            className="boton-principal w-full text-xl"
          >
            {girando ? `Girando… ${Math.ceil(restante)} s` : `Sortear «${proximo.nombre}»`}
          </button>
          {!enBloque && <p className="text-sm text-profundo/70">Para sortear, presentá el bloque del sorteo.</p>}
          {enBloque && quedan === 0 && <p className="text-sm font-semibold">No quedan participantes en la ruleta. Sumá gente abajo.</p>}
        </>
      ) : (
        <p className="font-semibold text-green-800">✓ Se sortearon todos los premios. Con «Siguiente» se pasa al bloque que sigue.</p>
      )}

      {ultimo && salio && (
        <div className="rounded-xl bg-crema p-3">
          {ultimo.estado === 'ganador' ? (
            <>
              <p className="text-sm text-profundo/70">Salió para «{premioDe(ultimo.prize_id)?.nombre}»:</p>
              <p className="font-titulo text-2xl font-bold">
                {salio.nombre}
                {salio.dato && <span className="ml-2 text-base text-profundo/60">{salio.dato}</span>}
              </p>
              <button
                disabled={ocupado}
                onClick={() =>
                  window.confirm(`¿${salio.nombre} no está? Sale de la ruleta y el premio se vuelve a sortear.`) &&
                  void ejecutar(() => sorteoAdmin.ausente(ultimo.id))
                }
                className="mt-2 min-h-toque rounded-xl border-2 border-profundo/15 px-3 text-sm font-semibold hover:bg-white disabled:opacity-40"
              >
                No está → se vuelve a sortear
              </button>
            </>
          ) : (
            <p className="text-sm font-semibold">
              {salio.nombre} no estaba: el premio «{premioDe(ultimo.prize_id)?.nombre}» se vuelve a sortear.
            </p>
          )}
        </div>
      )}
      {falla && <p className="rounded-xl bg-naranja/15 px-4 py-2 text-sm font-semibold">{falla}</p>}

      {ganadores.size > 0 && (
        <div>
          <h3 className="text-sm font-bold">Ganadores</h3>
          <ol className="flex flex-col gap-1 text-sm">
            {datos.premios
              .filter((p) => ganadores.has(p.id) && !(girando && ultimo?.prize_id === p.id))
              .map((p) => {
                const g = persona(ganadores.get(p.id))
                return (
                  <li key={p.id} className="flex gap-2 rounded-lg px-2 py-1 odd:bg-crema">
                    <span className="flex-1 text-profundo/70">{p.nombre}</span>
                    <span className="font-bold">{g?.nombre}</span>
                    {g?.dato && <span className="text-profundo/60">{g.dato}</span>}
                  </li>
                )
              })}
          </ol>
        </div>
      )}

      <div className="border-t border-profundo/10 pt-3">
        <button onClick={() => setSumar((x) => !x)} className="text-sm font-semibold text-azul">
          {sumar ? 'Cerrar' : `+ Sumar participantes (hay ${datos.participantes.length})`}
        </button>
        {sumar && (
          <div className="mt-2">
            <AgregarParticipantes eventId={eventId} onCambio={() => void recargar()} compacto />
          </div>
        )}
      </div>
    </section>
  )
}
