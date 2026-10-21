import { useState, type FormEvent } from 'react'
import { BotonPrincipal, BotonSecundario, CAMPO, Mensaje, Tarjeta } from '../admin/ui'
import { ErrorRpc } from '../lib/rpc'
import { extrasAdmin, type ExtraAdmin, type TipoExtra } from './rpc'
import { NOMBRE } from './textos'
import { useExtrasAdmin } from './useExtrasAdmin'

const mensajeDe = (e: unknown) => (e instanceof ErrorRpc ? e.message : 'Algo salió mal. Probá de nuevo.')

const ESTADO: Record<string, string> = { oculto: 'sin abrir', abierto: 'abierta/o', cerrado: 'cerrada/o' }

/** /admin/noche/:id — módulo opcional: prender misiones y/o desafíos y cargar sus listas. */
export function ArmarExtras({ eventId }: { eventId: string }) {
  const { datos, error, recargar } = useExtrasAdmin(eventId)
  const [ocupado, setOcupado] = useState(false)
  const [falla, setFalla] = useState<string | null>(null)

  if (error) return <Mensaje>{error}</Mensaje>
  if (!datos) return null

  const activar = async (misiones: boolean, desafios: boolean) => {
    setOcupado(true)
    setFalla(null)
    try {
      await extrasAdmin.activar(eventId, misiones, desafios)
      await recargar()
    } catch (e) {
      setFalla(mensajeDe(e))
    } finally {
      setOcupado(false)
    }
  }

  return (
    <Tarjeta titulo="Misiones secretas y desafíos">
      <p className="mb-3 text-sm text-profundo/70">
        Juegos fuera de la pantalla, opcionales. Si no tildás ninguno, la noche funciona como siempre. Se pueden apagar en cualquier
        momento (los puntos que ya se sumaron quedan).
      </p>
      <div className="mb-4 flex flex-wrap gap-x-6 gap-y-2">
        {(['mision', 'desafio'] as const).map((k) => {
          const activo = k === 'mision' ? datos.misiones : datos.desafios
          return (
            <label key={k} className="flex min-h-toque items-center gap-2 font-bold">
              <input
                type="checkbox"
                className="h-5 w-5"
                disabled={ocupado}
                checked={activo}
                onChange={(e) =>
                  void activar(k === 'mision' ? e.target.checked : datos.misiones, k === 'desafio' ? e.target.checked : datos.desafios)
                }
              />
              {NOMBRE[k].plural}
            </label>
          )
        })}
      </div>
      {falla && <Mensaje>{falla}</Mensaje>}
      <div className="flex flex-col gap-5">
        {datos.misiones && <Lista eventId={eventId} kind="mision" items={datos.items} onCambio={recargar} />}
        {datos.desafios && <Lista eventId={eventId} kind="desafio" items={datos.items} onCambio={recargar} />}
      </div>
    </Tarjeta>
  )
}

function Lista({ eventId, kind, items, onCambio }: { eventId: string; kind: TipoExtra; items: ExtraAdmin[]; onCambio: () => void }) {
  const propios = items.filter((x) => x.kind === kind)
  return (
    <div>
      <h3 className="font-bold">{NOMBRE[kind].plural}</h3>
      <p className="mb-2 text-sm text-profundo/70">{NOMBRE[kind].ayuda}</p>
      <ul className="flex flex-col gap-2">
        {propios.map((x) => (
          <li key={x.id}>
            <Fila eventId={eventId} kind={kind} extra={x} onCambio={onCambio} />
          </li>
        ))}
        {propios.length === 0 && <li className="text-sm text-profundo/70">Todavía no hay {NOMBRE[kind].plural.toLowerCase()}.</li>}
      </ul>
      <div className="mt-2">
        <Fila key={propios.length} eventId={eventId} kind={kind} extra={null} onCambio={onCambio} />
      </div>
    </div>
  )
}

/** Una misión o desafío (o el formulario para agregar uno nuevo, con extra = null). */
function Fila({ eventId, kind, extra, onCambio }: { eventId: string; kind: TipoExtra; extra: ExtraAdmin | null; onCambio: () => void }) {
  const [titulo, setTitulo] = useState(extra?.title ?? '')
  const [puntos, setPuntos] = useState(extra ? String(extra.points) : '')
  const [desc, setDesc] = useState(extra?.description ?? '')
  const [ocupado, setOcupado] = useState(false)
  const [falla, setFalla] = useState<string | null>(null)
  const cambiado = !extra || titulo !== extra.title || puntos !== String(extra.points) || desc !== (extra.description ?? '')

  const ejecutar = async (accion: () => Promise<unknown>, limpiar = false) => {
    setOcupado(true)
    setFalla(null)
    try {
      await accion()
      if (limpiar) {
        setTitulo('')
        setPuntos('')
        setDesc('')
      }
      onCambio()
    } catch (e) {
      setFalla(mensajeDe(e))
    } finally {
      setOcupado(false)
    }
  }

  const guardar = (e: FormEvent) => {
    e.preventDefault()
    void ejecutar(
      () =>
        extrasAdmin.guardar({
          id: extra?.id,
          event_id: eventId,
          kind,
          title: titulo,
          description: desc,
          points: Number(puntos),
        }),
      !extra,
    )
  }

  return (
    <form onSubmit={guardar} className={`flex flex-col gap-2 rounded-xl p-3 ${extra ? 'bg-crema' : 'border-2 border-dashed border-profundo/15'}`}>
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={titulo}
          onChange={(e) => setTitulo(e.target.value)}
          maxLength={120}
          placeholder={kind === 'mision' ? 'Ej.: Seguir a @familia.ludica' : 'Ej.: La primera mesa que traiga un zapato rojo'}
          aria-label="Nombre"
          className={`${CAMPO} min-w-[14rem] flex-1`}
        />
        <input
          value={puntos}
          onChange={(e) => setPuntos(e.target.value.replace(/\D/g, '').slice(0, 5))}
          inputMode="numeric"
          placeholder="Puntos"
          aria-label="Puntos"
          className={`${CAMPO} w-28`}
        />
        {extra && <span className="text-xs font-bold uppercase text-profundo/60">{ESTADO[extra.status]}</span>}
      </div>
      <input
        value={desc}
        onChange={(e) => setDesc(e.target.value)}
        maxLength={300}
        placeholder="Descripción para las mesas (opcional)"
        aria-label="Descripción"
        className={CAMPO}
      />
      {falla && <Mensaje>{falla}</Mensaje>}
      <div className="flex flex-wrap gap-2">
        {extra ? (
          <>
            <BotonSecundario type="submit" disabled={ocupado || !cambiado}>
              Guardar
            </BotonSecundario>
            <BotonSecundario
              type="button"
              disabled={ocupado}
              onClick={() => {
                if (window.confirm(`¿Borrar «${extra.title}»?`)) void ejecutar(() => extrasAdmin.borrar(extra.id))
              }}
            >
              Borrar
            </BotonSecundario>
            {extra.completions.length > 0 && (
              <span className="self-center text-sm text-profundo/70">
                {extra.completions.length} {extra.completions.length === 1 ? 'mesa sumó' : 'mesas sumaron'}
              </span>
            )}
          </>
        ) : (
          <BotonPrincipal type="submit" disabled={ocupado || !titulo.trim() || !puntos}>
            Agregar {NOMBRE[kind].singular}
          </BotonPrincipal>
        )}
      </div>
    </form>
  )
}
