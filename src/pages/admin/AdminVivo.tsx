import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useEstructura, type BloqueAdmin, type ItemAdmin } from '../../admin/useEstructura'
import { useMesasAdmin } from '../../admin/useMesasAdmin'
import { metaDe } from '../../dynamics/registro'
import { consigna, describirSolucion } from '../../dynamics/solucion'
import { ErrorRpc } from '../../lib/rpc'
import { admin } from '../../lib/rpcAdmin'
import type { EventoPublico, Fase, Live } from '../../lib/tipos'
import { useLive } from '../../live/useLive'
import { useTemporizador, type Temporizador } from '../../live/useTemporizador'

const FASES: { fase: Fase; nombre: string }[] = [
  { fase: 'cover', nombre: 'Portada' },
  { fase: 'block_intro', nombre: 'Presentación' },
  { fase: 'item_open', nombre: 'Abierto' },
  { fase: 'item_closed', nombre: 'Cerrado' },
  { fase: 'item_revealed', nombre: 'Revelado' },
  { fase: 'block_ranking', nombre: 'Ranking' },
  { fase: 'final', nombre: 'Final' },
]

/** /admin/vivo/:eventId — el conductor maneja la noche desde acá. */
export default function AdminVivo() {
  const { eventId = '' } = useParams()
  const { evento, bloques, error } = useEstructura(eventId)

  if (error) return <Mensaje>{error}</Mensaje>
  if (!evento) return <Mensaje>Cargando la noche…</Mensaje>
  return <Vivo evento={evento} bloques={bloques} />
}

function Vivo({ evento, bloques }: { evento: EventoPublico; bloques: BloqueAdmin[] }) {
  const { live, error, desfaseMs, recargar } = useLive(evento.code)
  const temporizador = useTemporizador(live, desfaseMs)
  const mesas = useMesasAdmin(evento.id, `${live?.updated_at}|${live?.teams_count}`)
  const [ocupado, setOcupado] = useState(false)
  const [aviso, setAviso] = useState<string | null>(null)
  const enCurso = useRef(false)

  const ejecutar = useCallback(
    async (accion: () => Promise<unknown>) => {
      if (enCurso.current) return
      enCurso.current = true
      setOcupado(true)
      setAviso(null)
      try {
        await accion()
        await recargar()
      } catch (e) {
        setAviso(e instanceof ErrorRpc ? e.message : 'Algo salió mal. Probá de nuevo.')
      } finally {
        enCurso.current = false
        setOcupado(false)
      }
    },
    [recargar],
  )

  const principal = live ? accionPrincipal(live, evento.id) : null
  const refPrincipal = useRef(principal)
  refPrincipal.current = principal

  // Atajo: espacio = acción principal de la fase (si no se está escribiendo ni hay un botón con foco).
  useEffect(() => {
    const alTeclear = (e: KeyboardEvent) => {
      if (e.code !== 'Space' || e.repeat) return
      const el = e.target as HTMLElement
      if (el.closest('input, textarea, select, button, a, [contenteditable]')) return
      e.preventDefault()
      const p = refPrincipal.current
      if (p) void ejecutar(p.accion)
    }
    window.addEventListener('keydown', alTeclear)
    return () => window.removeEventListener('keydown', alTeclear)
  }, [ejecutar])

  if (!live) return <Mensaje>{error ? error.message : 'Conectando…'}</Mensaje>

  const terminada = live.event.status === 'terminado'
  const bloque = bloques.find((b) => b.id === live.block?.id)
  const item = bloque?.items.find((i) => i.id === live.item?.block_item_id)
  const enJuego = live.phase === 'item_open' || live.phase === 'item_closed'
  const e = evento.id

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-col gap-3 rounded-carta bg-white p-4 shadow-md">
        <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
          <Link to="/admin" className="text-sm font-semibold text-azul">
            ← Noches
          </Link>
          <h1 className="text-2xl font-bold">{live.event.name}</h1>
          <p className="text-profundo/70">
            {live.block ? `${live.block.title}${live.item ? ` · ${metaDe(live.block.dynamic).sustantivo} ${live.item.number} de ${live.block.total_items}` : ''}` : 'Sin bloque'}
          </p>
          {error && <span className="rounded-full bg-naranja px-3 py-0.5 text-sm font-bold text-white">Reconectando…</span>}
        </div>
        <ol className="flex flex-wrap gap-2" aria-label="Fases">
          {FASES.map((f) => (
            <li
              key={f.fase}
              aria-current={f.fase === live.phase ? 'step' : undefined}
              className={`rounded-full px-3 py-1 text-sm font-bold ${f.fase === live.phase ? 'bg-naranja text-white' : 'bg-crema text-profundo/50'}`}
            >
              {f.nombre}
            </li>
          ))}
        </ol>
      </header>

      {terminada && (
        <p className="rounded-carta bg-profundo px-4 py-3 font-semibold text-white">
          Esta noche terminó. Para volver a usarla hay que reiniciarla (paso 11).
        </p>
      )}
      {aviso && (
        <p role="alert" className="rounded-carta bg-naranja/15 px-4 py-3 font-semibold">
          {aviso}
        </p>
      )}

      <div className="grid gap-4 lg:grid-cols-[1.25fr_1fr_0.85fr]">
        {/* Izquierda: ítem actual con solución y controles */}
        <section className="flex flex-col gap-4">
          <Tarjeta titulo="Ahora">
            {item ? <ItemConSolucion item={item} /> : <p className="text-profundo/70">{textoSinItem(live)}</p>}
            {live.item && <Reloj temporizador={temporizador} fase={live.phase} />}
          </Tarjeta>

          <div className="flex flex-col gap-3 rounded-carta bg-white p-4 shadow-md">
            {principal && !terminada && (
              <button disabled={ocupado} onClick={() => void ejecutar(principal.accion)} className="boton-principal w-full text-xl">
                {principal.etiqueta} <span className="ml-2 text-sm font-normal opacity-80">(espacio)</span>
              </button>
            )}
            <div className="grid grid-cols-3 gap-2">
              <Boton activo={live.phase === 'block_intro'} ocupado={ocupado} onClick={() => ejecutar(() => admin.next(e))}>
                Abrir
              </Boton>
              <Boton activo={live.phase === 'item_open'} ocupado={ocupado} onClick={() => ejecutar(() => admin.closeItem(e))}>
                Cerrar
              </Boton>
              <Boton
                activo={live.phase === 'item_open' && live.timer_seconds != null}
                ocupado={ocupado}
                onClick={() => ejecutar(() => admin.addTime(e, 15))}
              >
                +15 s
              </Boton>
              <Boton activo={live.phase === 'item_closed'} ocupado={ocupado} onClick={() => ejecutar(() => admin.reopenItem(e))}>
                Reabrir
              </Boton>
              <Boton activo={live.phase === 'item_closed'} ocupado={ocupado} onClick={() => ejecutar(() => admin.reveal(e))}>
                Revelar
              </Boton>
              <Boton
                activo={['cover', 'item_revealed', 'block_ranking'].includes(live.phase)}
                ocupado={ocupado}
                onClick={() => ejecutar(() => admin.next(e))}
              >
                Siguiente
              </Boton>
            </div>
            <div className="flex flex-wrap gap-2 border-t border-profundo/10 pt-3 text-sm">
              <BotonChico
                activo={!enJuego && live.phase !== 'cover'}
                ocupado={ocupado}
                onClick={() => ejecutar(() => admin.startEvent(e))}
              >
                Volver a la portada
              </BotonChico>
              <BotonChico
                activo={!enJuego && Boolean(live.block) && !live.block?.is_practice && live.phase !== 'block_ranking'}
                ocupado={ocupado}
                onClick={() => ejecutar(() => admin.showBlockRanking(e))}
              >
                Ranking del bloque
              </BotonChico>
              <BotonChico
                activo={!enJuego}
                ocupado={ocupado}
                onClick={() => {
                  if (window.confirm('¿Terminar la noche? Queda cerrada y no se puede seguir jugando sin reiniciarla.')) {
                    void ejecutar(() => admin.finish(e))
                  }
                }}
              >
                Terminar la noche
              </BotonChico>
            </div>
          </div>

          <Tarjeta titulo="Bloques">
            <ol className="flex flex-col gap-4">
              {bloques.map((b) => (
                <NavBloque
                  key={b.id}
                  bloque={b}
                  live={live}
                  bloqueado={enJuego || ocupado || terminada}
                  onPresentar={() => ejecutar(() => admin.startBlock(e, b.id))}
                  onAbrir={(id) => ejecutar(() => admin.openItem(e, id))}
                />
              ))}
            </ol>
          </Tarjeta>
        </section>

        {/* Centro: respuestas (el detalle con validación llega en el paso 6) */}
        <section>
          <Tarjeta titulo={live.item ? `Respuestas · ${live.answers_count} de ${live.teams_count}` : 'Respuestas'}>
            {!live.item ? (
              <p className="text-profundo/70">Cuando abras un ítem, acá vas a ver quién respondió.</p>
            ) : (
              <ul className="flex flex-col gap-1">
                {[...live.teams]
                  .sort((a, b) => Number(live.answered.includes(b.id)) - Number(live.answered.includes(a.id)))
                  .map((m) => (
                    <li key={m.id} className="flex items-center justify-between rounded-lg px-2 py-1.5 odd:bg-crema">
                      <span className="font-semibold">{m.name}</span>
                      {live.answered.includes(m.id) ? (
                        <span className="font-bold text-green-700">✔ respondió</span>
                      ) : (
                        <span className="text-profundo/50">sin respuesta</span>
                      )}
                    </li>
                  ))}
              </ul>
            )}
          </Tarjeta>
        </section>

        {/* Derecha: mesas con PIN y conexión (puntos manuales, historial y ranking: paso 8) */}
        <section>
          <Tarjeta titulo={`Mesas · ${mesas.length}`}>
            {mesas.length === 0 ? (
              <p className="text-profundo/70">Todavía no se registró ninguna mesa.</p>
            ) : (
              <ul className="flex flex-col gap-1">
                {mesas.map((m) => (
                  <li key={m.id} className="flex items-center gap-2 rounded-lg px-2 py-1.5 odd:bg-crema">
                    <span
                      className={`h-2.5 w-2.5 shrink-0 rounded-full ${m.connected ? 'bg-green-600' : 'bg-naranja'}`}
                      title={m.connected ? 'Conectada' : 'Desconectada'}
                    />
                    <span className="min-w-0 flex-1 truncate font-semibold">{m.name}</span>
                    <span className="font-titulo tracking-widest text-profundo/70">{m.pin}</span>
                  </li>
                ))}
              </ul>
            )}
          </Tarjeta>
        </section>
      </div>
    </div>
  )
}

function accionPrincipal(live: Live, e: string): { etiqueta: string; accion: () => Promise<unknown> } | null {
  const sustantivo = metaDe(live.block?.dynamic).sustantivo
  switch (live.phase) {
    case 'cover':
      return { etiqueta: 'Empezar el primer bloque', accion: () => admin.next(e) }
    case 'block_intro':
      return { etiqueta: `Abrir la primera ${sustantivo}`.replace('primera ítem', 'primer ítem'), accion: () => admin.next(e) }
    case 'item_open':
      return { etiqueta: 'Cerrar respuestas', accion: () => admin.closeItem(e) }
    case 'item_closed':
      return { etiqueta: 'Revelar', accion: () => admin.reveal(e) }
    case 'item_revealed':
      return { etiqueta: 'Siguiente', accion: () => admin.next(e) }
    case 'block_ranking':
      return { etiqueta: 'Siguiente bloque', accion: () => admin.next(e) }
    case 'final':
      return null
  }
}

function textoSinItem(live: Live): string {
  if (live.phase === 'cover') return 'Portada: las mesas se están registrando.'
  if (live.phase === 'block_intro') return `Presentando «${live.block?.title}».`
  if (live.phase === 'block_ranking') return 'Mostrando el ranking del bloque.'
  if (live.phase === 'final') return 'Final de la noche.'
  return ''
}

function ItemConSolucion({ item }: { item: ItemAdmin }) {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-lg font-semibold">{consigna(item.tipo, item.content) || '(sin consigna)'}</p>
      {item.solution && (
        <div className="rounded-xl border-2 border-dashed border-naranja bg-naranja/5 px-3 py-2">
          <p className="text-xs font-extrabold uppercase tracking-wide text-naranja">Solo lo ves vos</p>
          <p className="text-lg font-bold">{describirSolucion(item.tipo, item.content, item.solution)}</p>
          {typeof item.solution.explicacion === 'string' && (
            <p className="text-sm text-profundo/70">{item.solution.explicacion}</p>
          )}
        </div>
      )}
    </div>
  )
}

function Reloj({ temporizador, fase }: { temporizador: Temporizador; fase: Fase }) {
  if (!temporizador) return <p className="mt-2 text-sm text-profundo/60">Sin temporizador</p>
  const s = Math.max(0, Math.ceil(temporizador.restantes))
  const texto = s > 0 ? `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}` : '¡Tiempo!'
  return (
    <p className={`mt-2 font-titulo text-3xl font-bold tabular-nums ${s <= 5 ? 'text-naranja' : ''}`}>
      {texto}
      {fase === 'item_closed' && <span className="ml-2 text-base font-semibold text-profundo/60">(cerrado)</span>}
    </p>
  )
}

function NavBloque(props: {
  bloque: BloqueAdmin
  live: Live
  bloqueado: boolean
  onPresentar: () => void
  onAbrir: (blockItemId: string) => void
}) {
  const { bloque: b, live, bloqueado, onPresentar, onAbrir } = props
  const actual = live.block?.id === b.id
  return (
    <li className={`rounded-xl border-2 p-3 ${actual ? 'border-azul' : 'border-profundo/10'}`}>
      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1">
          <p className="font-bold">
            {b.position}. {b.title}
            {b.is_practice && <span className="ml-2 text-xs font-extrabold uppercase text-naranja">práctica</span>}
          </p>
          <p className="text-xs text-profundo/60">
            {metaDe(b.dynamic).nombre} · ×{b.multiplier} · {b.config.timer_seconds ? `${b.config.timer_seconds} s` : 'sin tiempo'}
          </p>
        </div>
        <button
          disabled={bloqueado}
          onClick={onPresentar}
          className="min-h-toque rounded-xl border-2 border-profundo/15 px-3 text-sm font-semibold hover:bg-crema disabled:opacity-40"
        >
          Presentar
        </button>
      </div>
      <ol className="mt-2 flex flex-col gap-1">
        {b.items.map((i, n) => {
          const esActual = live.item?.block_item_id === i.id
          return (
            <li key={i.id} className={`flex items-center gap-2 rounded-lg px-2 py-1 text-sm ${esActual ? 'bg-azul/10 font-bold' : ''}`}>
              <span className="w-5 text-profundo/50">{n + 1}</span>
              <span className="min-w-0 flex-1 truncate">{consigna(i.tipo, i.content) || i.tipo}</span>
              <button
                disabled={bloqueado || esActual}
                onClick={() => onAbrir(i.id)}
                className="rounded-lg border border-profundo/20 px-2 py-1 text-xs font-semibold hover:bg-crema disabled:opacity-40"
              >
                Abrir
              </button>
            </li>
          )
        })}
      </ol>
    </li>
  )
}

function Tarjeta({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <div className="rounded-carta bg-white p-4 shadow-md">
      <h2 className="mb-3 text-lg font-bold">{titulo}</h2>
      {children}
    </div>
  )
}

function Boton({ activo, ocupado, onClick, children }: { activo: boolean; ocupado: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      disabled={!activo || ocupado}
      onClick={onClick}
      className="min-h-toque rounded-xl bg-azul px-3 font-titulo text-lg font-semibold text-white disabled:bg-profundo/10 disabled:text-profundo/30"
    >
      {children}
    </button>
  )
}

function BotonChico({ activo, ocupado, onClick, children }: { activo: boolean; ocupado: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      disabled={!activo || ocupado}
      onClick={onClick}
      className="min-h-toque rounded-xl border-2 border-profundo/15 px-3 font-semibold hover:bg-crema disabled:opacity-40"
    >
      {children}
    </button>
  )
}

function Mensaje({ children }: { children: ReactNode }) {
  return <p className="rounded-carta bg-white p-6 text-center font-semibold shadow-md">{children}</p>
}
