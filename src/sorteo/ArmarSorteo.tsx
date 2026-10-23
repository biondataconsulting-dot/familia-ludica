import { useState, type FormEvent } from 'react'
import { SubirImagen } from '../admin/SubirImagen'
import { BotonPrincipal, BotonSecundario, CAMPO, Etiqueta, Mensaje, Tarjeta } from '../admin/ui'
import { ErrorRpc } from '../lib/rpc'
import { leerParticipantes } from './pegar'
import { sorteoAdmin, type PremioAdmin, type SorteoAdmin } from './rpc'
import { useSorteoAdmin } from './useSorteo'

const mensajeDe = (e: unknown) => (e instanceof ErrorRpc ? e.message : 'Algo salió mal. Probá de nuevo.')

/** /admin/noche/:id — premios y participantes del sorteo (solo si la noche tiene el bloque Sorteo). */
export function ArmarSorteo({ eventId }: { eventId: string }) {
  const { datos, error, recargar } = useSorteoAdmin(eventId)
  if (error) return <Mensaje>{error}</Mensaje>
  if (!datos) return null
  return (
    <Tarjeta titulo="Sorteo">
      <p className="mb-4 text-sm text-profundo/70">
        En el bloque del sorteo, la ruleta gira con los participantes y la base elige al ganador al azar (nadie puede influir). Los
        premios salen de a uno, en este orden, y nadie gana dos veces.
      </p>
      <div className="grid gap-6 lg:grid-cols-2">
        <Premios eventId={eventId} premios={datos.premios} sorteos={datos.sorteos} onCambio={recargar} />
        <Participantes eventId={eventId} datos={datos} onCambio={recargar} />
      </div>
    </Tarjeta>
  )
}

function Premios(props: { eventId: string; premios: PremioAdmin[]; sorteos: SorteoAdmin['sorteos']; onCambio: () => void }) {
  const { eventId, premios, sorteos, onCambio } = props
  const [editando, setEditando] = useState<PremioAdmin | 'nuevo' | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const [falla, setFalla] = useState<string | null>(null)
  const sorteado = (id: string) => sorteos.some((s) => s.prize_id === id && s.estado === 'ganador')

  const ejecutar = async (accion: () => Promise<unknown>) => {
    setOcupado(true)
    setFalla(null)
    try {
      await accion()
      onCambio()
    } catch (e) {
      setFalla(mensajeDe(e))
    } finally {
      setOcupado(false)
    }
  }

  return (
    <div>
      <div className="mb-2 flex items-center gap-2">
        <h3 className="font-bold">Premios · {premios.length}</h3>
        {premios.length < 10 && (
          <BotonSecundario className="ml-auto" disabled={ocupado} onClick={() => setEditando('nuevo')}>
            + Premio
          </BotonSecundario>
        )}
      </div>
      {premios.length === 0 && <p className="text-sm text-profundo/60">Todavía no hay premios. Se sortean en el orden de la lista.</p>}
      <ol className="flex flex-col gap-1">
        {premios.map((p, i) => (
          <li key={p.id} className="flex items-center gap-2 rounded-lg px-2 py-1 text-sm odd:bg-crema">
            <span className="w-6 text-profundo/50">{i + 1}</span>
            {p.imagen && <img src={p.imagen} alt="" className="h-10 w-10 rounded object-contain" />}
            <span className="min-w-0 flex-1 truncate font-semibold">
              {p.nombre}
              {sorteado(p.id) && <span className="ml-2 text-green-700">✓ sorteado</span>}
            </span>
            <button disabled={ocupado || i === 0} onClick={() => void ejecutar(() => sorteoAdmin.premioMover(p.id, -1))} className="px-2 disabled:opacity-30" aria-label="Subir">
              ↑
            </button>
            <button
              disabled={ocupado || i === premios.length - 1}
              onClick={() => void ejecutar(() => sorteoAdmin.premioMover(p.id, 1))}
              className="px-2 disabled:opacity-30"
              aria-label="Bajar"
            >
              ↓
            </button>
            <button disabled={ocupado} onClick={() => setEditando(p)} className="px-2 text-azul">
              Editar
            </button>
            <button
              disabled={ocupado}
              onClick={() => window.confirm(`¿Borrar el premio «${p.nombre}»?`) && void ejecutar(() => sorteoAdmin.premioBorrar(p.id))}
              className="px-2 text-naranja"
              aria-label="Borrar premio"
            >
              ✕
            </button>
          </li>
        ))}
      </ol>
      {falla && (
        <div className="mt-2">
          <Mensaje>{falla}</Mensaje>
        </div>
      )}
      {editando && (
        <FormPremio
          key={editando === 'nuevo' ? 'nuevo' : editando.id}
          eventId={eventId}
          premio={editando === 'nuevo' ? null : editando}
          onListo={() => {
            setEditando(null)
            onCambio()
          }}
          onCancelar={() => setEditando(null)}
        />
      )}
    </div>
  )
}

function FormPremio(props: { eventId: string; premio: PremioAdmin | null; onListo: () => void; onCancelar: () => void }) {
  const { eventId, premio, onListo, onCancelar } = props
  const [nombre, setNombre] = useState(premio?.nombre ?? '')
  const [imagen, setImagen] = useState(premio?.imagen ?? '')
  const [ocupado, setOcupado] = useState(false)
  const [falla, setFalla] = useState<string | null>(null)

  const guardar = async (e: FormEvent) => {
    e.preventDefault()
    setOcupado(true)
    setFalla(null)
    try {
      await sorteoAdmin.premio({ id: premio?.id, event_id: eventId, nombre, imagen })
      onListo()
    } catch (err) {
      setFalla(mensajeDe(err))
    } finally {
      setOcupado(false)
    }
  }

  return (
    <form onSubmit={guardar} className="mt-3 flex flex-col gap-3 rounded-xl border-2 border-profundo/10 p-3">
      <Etiqueta texto={premio ? 'Editar premio' : 'Premio nuevo'}>
        <input value={nombre} onChange={(e) => setNombre(e.target.value)} maxLength={80} required placeholder="Ej.: Caja de juegos" className={CAMPO} autoFocus />
      </Etiqueta>
      <SubirImagen url={imagen} onCambio={setImagen} />
      {falla && <Mensaje>{falla}</Mensaje>}
      <div className="flex gap-2">
        <BotonPrincipal disabled={ocupado}>Guardar</BotonPrincipal>
        <BotonSecundario type="button" onClick={onCancelar}>
          Cancelar
        </BotonSecundario>
      </div>
    </form>
  )
}

function Participantes({ eventId, datos, onCambio }: { eventId: string; datos: SorteoAdmin; onCambio: () => void }) {
  const [buscar, setBuscar] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const [falla, setFalla] = useState<string | null>(null)
  const ganadores = new Set(datos.sorteos.filter((s) => s.estado === 'ganador').map((s) => s.participant_id))
  const filtro = buscar.trim().toLowerCase()
  const vistos = datos.participantes.filter((p) => !filtro || `${p.nombre} ${p.dato ?? ''}`.toLowerCase().includes(filtro))

  const ejecutar = async (accion: () => Promise<unknown>) => {
    setOcupado(true)
    setFalla(null)
    try {
      await accion()
      onCambio()
    } catch (e) {
      setFalla(mensajeDe(e))
    } finally {
      setOcupado(false)
    }
  }

  return (
    <div>
      <div className="mb-2 flex items-center gap-2">
        <h3 className="font-bold">Participantes · {datos.participantes.length}</h3>
        {datos.participantes.length > 0 && datos.sorteos.length === 0 && (
          <BotonSecundario
            className="ml-auto"
            disabled={ocupado}
            onClick={() =>
              window.confirm(`¿Sacar a los ${datos.participantes.length} participantes de la lista?`) && void ejecutar(() => sorteoAdmin.vaciar(eventId))
            }
          >
            Vaciar lista
          </BotonSecundario>
        )}
      </div>
      <AgregarParticipantes eventId={eventId} onCambio={onCambio} />
      {datos.participantes.length > 8 && (
        <input value={buscar} onChange={(e) => setBuscar(e.target.value)} placeholder="Buscar en la lista…" className={`${CAMPO} mt-3`} />
      )}
      {falla && (
        <div className="mt-2">
          <Mensaje>{falla}</Mensaje>
        </div>
      )}
      <ul className="mt-2 flex max-h-96 flex-col gap-1 overflow-y-auto">
        {vistos.slice(0, 300).map((p) => (
          <li key={p.id} className="flex items-center gap-2 rounded-lg px-2 py-1 text-sm odd:bg-crema">
            <span className="min-w-0 flex-1 truncate">
              <span className="font-semibold">{p.nombre}</span>
              {p.dato && <span className="text-profundo/60"> · {p.dato}</span>}
              {ganadores.has(p.id) && <span className="ml-2 text-green-700">🏆 ganó</span>}
              {p.ausente && <span className="ml-2 text-profundo/50">no estaba</span>}
            </span>
            {!ganadores.has(p.id) && (
              <button disabled={ocupado} onClick={() => void ejecutar(() => sorteoAdmin.quitar(p.id))} className="px-2 text-naranja" aria-label={`Sacar a ${p.nombre}`}>
                ✕
              </button>
            )}
          </li>
        ))}
        {vistos.length > 300 && <li className="px-2 text-sm text-profundo/60">… y {vistos.length - 300} más (buscá para encontrarlos).</li>}
      </ul>
    </div>
  )
}

/** Pegar de Excel, subir un CSV o agregar a mano. Se usa en Armar y en Conducir (durante la noche). */
export function AgregarParticipantes({ eventId, onCambio, compacto = false }: { eventId: string; onCambio: () => void; compacto?: boolean }) {
  const [nombre, setNombre] = useState('')
  const [dato, setDato] = useState('')
  const [pegado, setPegado] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const [resultado, setResultado] = useState<{ ok: boolean; texto: string } | null>(null)

  const agregar = async (lista: { nombre: string; dato?: string }[]) => {
    if (lista.length === 0) return setResultado({ ok: false, texto: 'No encontramos nombres. La primera columna tiene que ser el nombre.' })
    setOcupado(true)
    setResultado(null)
    try {
      const r = await sorteoAdmin.agregar(eventId, lista)
      const rep = r.repetidos.length
      setResultado({
        ok: true,
        texto:
          `${r.agregados === 1 ? 'Se agregó 1 participante' : `Se agregaron ${r.agregados} participantes`}.` +
          (rep ? ` ${rep === 1 ? '1 ya estaba' : `${rep} ya estaban`} (no se repiten): ${r.repetidos.slice(0, 5).join(', ')}${rep > 5 ? '…' : ''}.` : ''),
      })
      setPegado('')
      setNombre('')
      setDato('')
      onCambio()
    } catch (e) {
      setResultado({ ok: false, texto: mensajeDe(e) })
    } finally {
      setOcupado(false)
    }
  }

  const leerArchivo = async (archivo: File | undefined) => {
    if (!archivo) return
    void agregar(leerParticipantes(await archivo.text()))
  }

  return (
    <div className="flex flex-col gap-3">
      <form
        onSubmit={(e) => {
          e.preventDefault()
          void agregar([{ nombre, dato }])
        }}
        className="grid grid-cols-[1.4fr_1fr_auto] items-end gap-2"
      >
        <Etiqueta texto="Nombre">
          <input value={nombre} onChange={(e) => setNombre(e.target.value)} maxLength={80} required className={CAMPO} />
        </Etiqueta>
        <Etiqueta texto="Dato" ayuda="(lote, entrada o DNI)">
          <input value={dato} onChange={(e) => setDato(e.target.value)} maxLength={40} className={CAMPO} />
        </Etiqueta>
        <BotonPrincipal disabled={ocupado}>Agregar</BotonPrincipal>
      </form>
      {!compacto && (
        <div className="flex flex-col gap-2">
          <Etiqueta texto="Pegar desde Excel" ayuda="(columna A: nombre · columna B: lote, entrada o DNI)">
            <textarea
              value={pegado}
              onChange={(e) => setPegado(e.target.value)}
              rows={4}
              placeholder={'Ana Pérez\tLote 12\nBeto Gómez\tLote 7'}
              className={`${CAMPO} py-2 font-mono text-sm`}
            />
          </Etiqueta>
          <div className="flex flex-wrap items-center gap-2">
            <BotonSecundario disabled={ocupado || !pegado.trim()} onClick={() => void agregar(leerParticipantes(pegado))}>
              Agregar lo pegado
              {pegado.trim() ? ` (${leerParticipantes(pegado).length})` : ''}
            </BotonSecundario>
            <label className="cursor-pointer text-sm font-semibold text-azul">
              o subir un CSV
              <input
                type="file"
                accept=".csv,.txt,text/csv,text/plain"
                className="sr-only"
                disabled={ocupado}
                onChange={(e) => {
                  void leerArchivo(e.target.files?.[0])
                  e.target.value = ''
                }}
              />
            </label>
          </div>
        </div>
      )}
      {resultado && <Mensaje tipo={resultado.ok ? 'ok' : 'error'}>{resultado.texto}</Mensaje>}
    </div>
  )
}
