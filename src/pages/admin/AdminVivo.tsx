import { useCierreAutomatico } from '../../live/useCierreAutomatico'
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useEstructura, type BloqueAdmin, type ItemAdmin } from '../../admin/useEstructura'
import { PanelPuntos } from '../../admin/PanelPuntos'
import { TablaRespuestas } from '../../admin/TablaRespuestas'
import { useMesasAdmin } from '../../admin/useMesasAdmin'
import { extrasActivos } from '../../extras/useExtras'
import { VivoExtras } from '../../extras/VivoExtras'
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
  const { evento, bloques, error, recargar: recargarEstructura } = useEstructura(eventId)

  // Bloques agregados en Armar con la noche en vivo: aparecen al volver a esta pestaña (y cada 15 s).
  useEffect(() => {
    const id = window.setInterval(() => void recargarEstructura(), 15000)
    const alVolver = () => void recargarEstructura()
    window.addEventListener('focus', alVolver)
    return () => {
      window.clearInterval(id)
      window.removeEventListener('focus', alVolver)
    }
  }, [recargarEstructura])

  if (error) return <Mensaje>{error}</Mensaje>
  if (!evento) return <Mensaje>Cargando la noche…</Mensaje>
  return <Vivo evento={evento} bloques={bloques} />
}

function Vivo({ evento, bloques }: { evento: EventoPublico; bloques: BloqueAdmin[] }) {
  const { live, error, desfaseMs, recargar, pedirRepetir } = useLive(evento.code)
  const temporizador = useTemporizador(live, desfaseMs)
  // Al llegar a 0 se cierran las respuestas solas (la base confirma que el tiempo se cumplió).
  useCierreAutomatico(evento.code, live, temporizador)
  const mesas = useMesasAdmin(evento.id, `${live?.updated_at}|${live?.teams_count}`)
  const [dudosas, setDudosas] = useState(0)
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

  // Revelar con dudosas sin decidir: avisa que cuentan como rechazadas.
  const revelar = useCallback(async () => {
    if (
      dudosas > 0 &&
      !window.confirm(`Quedan ${dudosas} ${dudosas === 1 ? 'dudosa' : 'dudosas'} sin decidir: si revelás ahora cuentan como rechazadas. ¿Revelar igual?`)
    ) {
      return
    }
    await admin.reveal(evento.id)
  }, [dudosas, evento.id])

  const conMedia = ['pista_audio', 'clip_video'].includes(live?.item?.type ?? '') &&
    ['item_open', 'item_closed', 'item_revealed'].includes(live?.phase ?? '')
  const base = live ? accionPrincipal(live, evento.id) : null
  const principal = base && live?.phase === 'item_closed' ? { ...base, accion: revelar } : base
  const refPrincipal = useRef(principal)
  refPrincipal.current = principal
  const refRepetir = useRef<(() => void) | null>(null)
  refRepetir.current = conMedia ? pedirRepetir : null

  // Atajos: espacio = acción principal de la fase; R = repetir el audio (si no se está escribiendo).
  useEffect(() => {
    const alTeclear = (e: KeyboardEvent) => {
      if (e.repeat) return
      const el = e.target as HTMLElement
      if (el.closest('input, textarea, select, [contenteditable]')) return
      if (e.key === 'r' || e.key === 'R') {
        refRepetir.current?.()
        return
      }
      if (e.code !== 'Space' || el.closest('button, a')) return
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
  // Canción o escena abierta que el proyector no reprodujo en 8 s (el reloj la está esperando).
  const videoTrabado =
    live.phase === 'item_open' &&
    Boolean(live.media_waiting) &&
    live.opened_at != null &&
    Date.now() + desfaseMs - Date.parse(live.opened_at) > 8000
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
        {/* Botones de pantalla: se prenden y se apagan; el resto del juego sigue igual. */}
        <div className="flex flex-wrap gap-2">
          <button
            disabled={ocupado}
            aria-pressed={Boolean(live.show_qr)}
            onClick={() => void ejecutar(() => admin.pantalla(e, !live.show_qr, null))}
            className={`min-h-toque rounded-xl px-4 font-semibold disabled:opacity-40 ${live.show_qr ? 'bg-profundo text-white' : 'border-2 border-profundo/15 hover:bg-crema'}`}
          >
            {live.show_qr ? 'Ocultar QR' : 'Mostrar QR para volver a entrar'}
          </button>
          <button
            disabled={ocupado || (live.phase === 'item_open' && !live.show_ranking) || live.phase === 'final'}
            title={live.phase === 'item_open' ? 'Con una pregunta abierta no se muestra (taparía las respuestas)' : undefined}
            aria-pressed={Boolean(live.show_ranking)}
            onClick={() => void ejecutar(() => admin.pantalla(e, null, !live.show_ranking))}
            className={`min-h-toque rounded-xl px-4 font-semibold disabled:opacity-40 ${live.show_ranking ? 'bg-profundo text-white' : 'border-2 border-profundo/15 hover:bg-crema'}`}
          >
            {live.show_ranking ? 'Ocultar cómo va la noche' : '📊 Mostrar cómo va la noche'}
          </button>
        </div>
      </header>

      {terminada && (
        <div className="flex flex-wrap items-center gap-3 rounded-carta bg-profundo px-4 py-3 font-semibold text-white">
          <p className="min-w-0 flex-1">
            Esta noche terminó. ¿Quieren seguir jugando? Reanudala y presentá otro bloque (si hace falta, agregalo en Armar). Para
            empezar de cero,{' '}
            <Link to={`/admin/ensayo/${evento.id}`} className="underline">
              reiniciala desde el ensayo
            </Link>
            .
          </p>
          <button
            disabled={ocupado}
            onClick={() => {
              if (window.confirm('¿Reanudar la noche? El proyector pasa del podio al ranking y podés presentar otro bloque.')) {
                void ejecutar(() => admin.resume(e))
              }
            }}
            className="min-h-toque rounded-xl bg-naranja px-4 font-titulo font-semibold text-white disabled:opacity-40"
          >
            Reanudar la noche
          </button>
        </div>
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
            {item && conMedia && <Fragmento item={item} onRepetir={pedirRepetir} />}
            {videoTrabado && (
              <Mensaje>
                ⚠ El video todavía no arrancó en el proyector. Tocá «Repetir»; si sigue igual, recargá el proyector (F5 y «Comenzar la
                noche»): la pregunta sigue abierta y el reloj espera.
              </Mensaje>
            )}
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
              <Boton activo={live.phase === 'item_closed'} ocupado={ocupado} onClick={() => ejecutar(revelar)}>
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

        {/* Centro: respuestas con estado y puntos provisorios */}
        <section>
          <Tarjeta titulo={live.item ? `Respuestas · ${live.answers_count} de ${live.teams_count}` : 'Respuestas'}>
            <TablaRespuestas live={live} eventId={evento.id} onDudosas={setDudosas} />
          </Tarjeta>
        </section>

        {/* Derecha: puntos (ranking, manuales, historial) y mesas con PIN y conexión */}
        <section className="flex flex-col gap-4">
          <Tarjeta titulo="Puntos">
            <PanelPuntos live={live} eventId={evento.id} />
          </Tarjeta>
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
                    <span className="shrink-0 text-profundo/70">
                      <span className="text-xs font-bold uppercase">PIN:</span>{' '}
                      <span className="font-titulo tracking-widest">{m.pin}</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Tarjeta>
        </section>
      </div>

      {/* Módulo opcional: solo si la noche tiene misiones o desafíos prendidos. */}
      {extrasActivos(live) && <VivoExtras eventId={evento.id} live={live} />}
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

const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`

/** Audio/video: qué fragmento suena y "▶ Repetir" (también con la tecla R). */
function Fragmento({ item, onRepetir }: { item: ItemAdmin; onRepetir: () => void }) {
  const duracion = Number(item.content.duracion ?? 20)
  return (
    <div className="mt-3 flex items-center gap-3 rounded-xl bg-crema px-3 py-2">
      <p className="flex-1 text-sm">
        Suena desde el principio: <span className="font-bold">0:00</span> a <span className="font-bold">{mmss(duracion)}</span> ({duracion} s)
      </p>
      <button onClick={onRepetir} className="min-h-toque rounded-xl bg-naranja px-4 font-titulo font-semibold text-white">
        ▶ Repetir <span className="text-xs opacity-80">(R)</span>
      </button>
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
