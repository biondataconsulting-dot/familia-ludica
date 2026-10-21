import { useState } from 'react'
import { BotonPrincipal, BotonSecundario, Mensaje, Tarjeta } from '../admin/ui'
import { formatearNumero } from '../dynamics/solucion'
import { ErrorRpc } from '../lib/rpc'
import type { Live } from '../lib/tipos'
import { extrasAdmin, type ExtraAdmin } from './rpc'
import { useExtrasAdmin } from './useExtrasAdmin'

/** /admin/vivo/:id — misiones (abrir/cerrar todas, tildar por mesa) y desafíos (lanzar, elegir ganadora). */
export function VivoExtras({ eventId, live }: { eventId: string; live: Live }) {
  const { datos, error, recargar } = useExtrasAdmin(eventId, live.server_now)
  const [ocupado, setOcupado] = useState(false)
  const [falla, setFalla] = useState<string | null>(null)

  const ejecutar = async (accion: () => Promise<unknown>) => {
    if (ocupado) return
    setOcupado(true)
    setFalla(null)
    try {
      await accion()
      await recargar()
    } catch (e) {
      setFalla(e instanceof ErrorRpc ? e.message : 'Algo salió mal. Probá de nuevo.')
    } finally {
      setOcupado(false)
    }
  }

  if (error) return <Mensaje>{error}</Mensaje>
  if (!datos) return null
  const misiones = datos.items.filter((x) => x.kind === 'mision')
  const desafios = datos.items.filter((x) => x.kind === 'desafio')
  const nombreMesa = (id: string) => live.teams.find((t) => t.id === id)?.name ?? 'Mesa que ya no está'

  return (
    <div className="flex flex-col gap-4">
      {falla && <Mensaje>{falla}</Mensaje>}
      {datos.misiones && <Misiones eventId={eventId} live={live} misiones={misiones} ocupado={ocupado} ejecutar={ejecutar} />}
      {datos.desafios && (
        <Tarjeta titulo="Desafíos">
          {desafios.length === 0 ? (
            <p className="text-profundo/70">Todavía no hay desafíos. Cargalos en Armar.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {desafios.map((d) => (
                <Desafio
                  key={d.id}
                  desafio={d}
                  live={live}
                  hayOtroEnCurso={desafios.some((o) => o.id !== d.id && o.status === 'abierto')}
                  nombreMesa={nombreMesa}
                  ocupado={ocupado}
                  ejecutar={ejecutar}
                />
              ))}
            </ul>
          )}
        </Tarjeta>
      )}
    </div>
  )
}

type PropsEjecutar = { ocupado: boolean; ejecutar: (accion: () => Promise<unknown>) => Promise<void> }

function Misiones({ eventId, live, misiones, ocupado, ejecutar }: { eventId: string; live: Live; misiones: ExtraAdmin[] } & PropsEjecutar) {
  const abiertas = misiones.some((m) => m.status === 'abierto')
  const algunaVez = misiones.some((m) => m.status !== 'oculto')
  const estado = abiertas ? 'Abiertas: las mesas las ven en el celular' : algunaVez ? 'Cerradas' : 'Sin abrir: las mesas todavía no las ven'

  return (
    <Tarjeta
      titulo={`Misiones secretas · ${estado}`}
      acciones={
        misiones.length > 0 &&
        (abiertas ? (
          <BotonSecundario disabled={ocupado} onClick={() => void ejecutar(() => extrasAdmin.misiones(eventId, false))}>
            Cerrar misiones
          </BotonSecundario>
        ) : (
          <BotonPrincipal disabled={ocupado} onClick={() => void ejecutar(() => extrasAdmin.misiones(eventId, true))}>
            {algunaVez ? 'Volver a abrir' : 'Abrir misiones'}
          </BotonPrincipal>
        ))
      }
    >
      {misiones.length === 0 ? (
        <p className="text-profundo/70">Todavía no hay misiones. Cargalas en Armar.</p>
      ) : live.teams.length === 0 ? (
        <p className="text-profundo/70">Todavía no se registró ninguna mesa.</p>
      ) : (
        <div className="overflow-x-auto">
          {!algunaVez && <p className="mb-2 text-sm text-profundo/70">Para tildar, primero abrí las misiones.</p>}
          <table className="w-full text-left text-sm">
            <thead>
              <tr>
                <th className="py-1 pr-3">Mesa</th>
                {misiones.map((m) => (
                  <th key={m.id} className="max-w-[10rem] px-2 py-1 text-center align-bottom font-bold">
                    <span className="line-clamp-2">{m.title}</span>
                    <span className="block text-xs font-semibold text-profundo/60">+{formatearNumero(m.points)}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {live.teams.map((t) => (
                <tr key={t.id} className="odd:bg-crema">
                  <td className="py-1 pr-3 font-semibold">{t.name}</td>
                  {misiones.map((m) => {
                    const cumplida = m.completions.some((c) => c.team_id === t.id)
                    return (
                      <td key={m.id} className="px-2 py-1 text-center">
                        <input
                          type="checkbox"
                          className="h-6 w-6 cursor-pointer disabled:cursor-not-allowed"
                          aria-label={`${t.name}: ${m.title}`}
                          checked={cumplida}
                          disabled={ocupado || m.status === 'oculto'}
                          onChange={(e) => void ejecutar(() => extrasAdmin.marcar(m.id, t.id, e.target.checked))}
                        />
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Tarjeta>
  )
}

function Desafio(props: { desafio: ExtraAdmin; live: Live; hayOtroEnCurso: boolean; nombreMesa: (id: string) => string } & PropsEjecutar) {
  const { desafio: d, live, hayOtroEnCurso, nombreMesa, ocupado, ejecutar } = props
  const ganadora = d.completions[0]?.team_id

  return (
    <li className={`flex flex-col gap-2 rounded-xl p-3 ${d.status === 'abierto' ? 'border-2 border-naranja bg-naranja/10' : 'bg-crema'}`}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-bold">{d.title}</span>
        <span className="text-sm font-semibold text-profundo/70">+{formatearNumero(d.points)}</span>
        <span className="ml-auto flex flex-wrap items-center gap-2">
          {d.status === 'oculto' && (
            <BotonPrincipal disabled={ocupado || hayOtroEnCurso} onClick={() => void ejecutar(() => extrasAdmin.lanzar(d.id))}>
              Lanzar
            </BotonPrincipal>
          )}
          {d.status === 'abierto' && <span className="rounded-full bg-naranja px-3 py-1 text-sm font-bold text-white">En curso</span>}
          {d.status === 'cerrado' && (
            <>
              <span className="text-sm font-semibold">{ganadora ? `Ganó ${nombreMesa(ganadora)}` : 'Sin ganadora'}</span>
              <BotonSecundario disabled={ocupado || hayOtroEnCurso} onClick={() => void ejecutar(() => extrasAdmin.reabrir(d.id))}>
                Reabrir
              </BotonSecundario>
            </>
          )}
        </span>
      </div>
      {d.status === 'abierto' && (
        <>
          <p className="text-sm font-bold">¿Qué mesa llegó primero?</p>
          {live.teams.length === 0 ? (
            <p className="text-sm text-profundo/70">Todavía no se registró ninguna mesa.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {live.teams.map((t) => (
                <BotonSecundario key={t.id} disabled={ocupado} className="bg-white" onClick={() => void ejecutar(() => extrasAdmin.cerrar(d.id, t.id))}>
                  {t.name}
                </BotonSecundario>
              ))}
            </div>
          )}
          <button
            disabled={ocupado}
            onClick={() => void ejecutar(() => extrasAdmin.cerrar(d.id, null))}
            className="self-start text-sm font-semibold text-profundo/70 underline disabled:opacity-40"
          >
            Cerrar sin ganadora
          </button>
        </>
      )}
    </li>
  )
}
