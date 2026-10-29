import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { BotonPrincipal, BotonSecundario, CAMPO, Etiqueta, Mensaje, Tarjeta } from '../../admin/ui'
import { useCatalogo } from '../../admin/useCatalogo'
import { FORMATO, generarCartones, paraReimprimir, type TipoBingo } from '../../bingo/formato'
import { bingoAdmin, type CancionSet, type CartonGuardado, type SetBingo } from '../../bingo/rpc'
import { ErrorRpc } from '../../lib/rpc'

const mensajeDe = (e: unknown) => (e instanceof ErrorRpc ? e.message : 'Algo salió mal. Probá de nuevo.')
const TIPOS: TipoBingo[] = ['express', 'full']

/** /admin/bingo — sets de canciones del bingo musical (y /admin/bingo/:setId, uno en detalle). */
export default function AdminBingo() {
  const { setId } = useParams()
  return setId ? <UnSet setId={setId} /> : <Sets />
}

function Sets() {
  const [sets, setSets] = useState<SetBingo[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [nombre, setNombre] = useState('')
  const navegar = useNavigate()

  const recargar = useCallback(() => {
    bingoAdmin.sets().then(setSets, (e) => setError(mensajeDe(e)))
  }, [])
  useEffect(recargar, [recargar])

  const duplicar = async (s: SetBingo) => {
    setError(null)
    try {
      navegar(`/admin/bingo/${await bingoAdmin.duplicarSet(s.id)}`)
    } catch (err) {
      setError(mensajeDe(err))
    }
  }
  const borrar = async (s: SetBingo) => {
    if (!window.confirm(`¿Borrar el set «${s.name}» con sus canciones y cartones? No se puede deshacer.`)) return
    setError(null)
    try {
      await bingoAdmin.borrarSet(s.id)
      recargar()
    } catch (err) {
      setError(mensajeDe(err))
    }
  }

  const crear = async (e: FormEvent) => {
    e.preventDefault()
    try {
      const id = await bingoAdmin.guardarSet({ name: nombre })
      navegar(`/admin/bingo/${id}`)
    } catch (err) {
      setError(mensajeDe(err))
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <Tarjeta titulo="🎵 Bingo musical · sets de canciones">
        <p className="mb-3 text-sm text-profundo/70">
          Un set son hasta 90 canciones numeradas, cada una con el momento del estribillo. Con el set se generan los cartones
          (Express: canciones 1 a 40, ~15 min · Full: 1 a 90, ~30 min) y en una noche se agrega un bloque «Bingo musical».
          «Duplicar» copia las canciones a un set nuevo (sin cartones), también de un set ya jugado, para armar otra edición sin
          tocar el original.
        </p>
        {error && <Mensaje>{error}</Mensaje>}
        {sets?.length === 0 && <p className="text-sm text-profundo/60">Todavía no hay sets.</p>}
        <ul className="mb-4 flex flex-col gap-2">
          {sets?.map((s) => (
            <li key={s.id} className="flex items-center gap-2 rounded-xl border-2 border-profundo/10 pr-2 hover:bg-crema">
              <Link to={`/admin/bingo/${s.id}`} className="flex min-w-0 flex-1 px-4 py-3 font-semibold">
                {s.name}
                <span className="ml-auto text-azul">Abrir →</span>
              </Link>
              <BotonSecundario type="button" onClick={() => void duplicar(s)} title="Copia con las mismas canciones, sin cartones">
                Duplicar
              </BotonSecundario>
              <button type="button" onClick={() => void borrar(s)} className="px-2 font-semibold text-naranja" aria-label={`Borrar el set ${s.name}`}>
                Borrar
              </button>
            </li>
          ))}
        </ul>
        <form onSubmit={crear} className="flex items-end gap-2">
          <Etiqueta texto="Set nuevo">
            <input value={nombre} onChange={(e) => setNombre(e.target.value)} maxLength={80} required placeholder="Ej.: Rock nacional para cantar" className={CAMPO} />
          </Etiqueta>
          <BotonPrincipal>Crear</BotonPrincipal>
        </form>
      </Tarjeta>
    </div>
  )
}

type Datos = { set: SetBingo; canciones: CancionSet[]; cartones: CartonGuardado[] }

function UnSet({ setId }: { setId: string }) {
  const [datos, setDatos] = useState<Datos | null>(null)
  const [error, setError] = useState<string | null>(null)
  const { items } = useCatalogo()
  const [filtro, setFiltro] = useState('')

  const recargar = useCallback(async () => {
    try {
      setDatos(await bingoAdmin.set(setId))
      setError(null)
    } catch (e) {
      setError(mensajeDe(e))
    }
  }, [setId])
  useEffect(() => {
    void recargar()
  }, [recargar])

  const canciones = useMemo(
    () =>
      (items ?? [])
        .filter((i) => i.type === 'pista_audio')
        .map((i) => ({ id: i.id, texto: `${String(i.solution.titulo ?? '')} · ${String(i.solution.artista ?? '')}` }))
        .sort((a, b) => a.texto.localeCompare(b.texto)),
    [items],
  )

  if (error) return <Mensaje>{error}</Mensaje>
  if (!datos) return <p className="text-profundo/70">Cargando el set…</p>

  const porNumero = new Map(datos.canciones.map((c) => [c.number, c]))
  const usos = new Map<string, number>()
  for (const c of datos.canciones) usos.set(c.catalog_item_id, (usos.get(c.catalog_item_id) ?? 0) + 1)
  // Números que están en cartones generados: su canción se puede cambiar, pero hay que reimprimir esos cartones.
  const impresoHasta = Math.max(0, ...datos.cartones.map((c) => FORMATO[c.tipo].pool))
  const reimprimir = new Set(TIPOS.flatMap((t) => paraReimprimir(t, datos.canciones, datos.cartones, datos.set.impresos[t]).numeros))
  const f = filtro.trim().toLowerCase()

  return (
    <div className="flex flex-col gap-5">
      <Link to="/admin/bingo" className="text-sm font-semibold text-azul">
        ← Sets de bingo
      </Link>
      <NombreSet set={datos.set} onCambio={recargar} />
      <Cartones setId={setId} datos={datos} onCambio={recargar} />
      <Tarjeta titulo={`Canciones · ${datos.canciones.length} de 90`}>
        <p className="mb-2 text-sm text-profundo/70">
          Elegí la canción de cada número (del catálogo, tipo Hitster musical), el segundo donde empieza el estribillo y cuánto
          suena. «▶» abre YouTube justo en ese segundo. El «título para el cartón» es opcional (para títulos largos).
          {impresoHasta > 0 &&
            ` Los números del 1 al ${impresoHasta} ya están en cartones: si cambiás su canción o su título, reimprimí los cartones que la tienen (los números no cambian).`}
        </p>
        <div className="mb-3 flex flex-wrap gap-3 text-sm font-semibold">
          {TIPOS.map((t) => {
            const pool = FORMATO[t].pool
            const n = datos.canciones.filter((c) => c.number <= pool).length
            return (
              <span key={t} className={`rounded-full px-3 py-1 ${n === pool ? 'bg-green-100 text-green-800' : 'bg-crema'}`}>
                {FORMATO[t].nombre}: {n} de {pool} {n === pool ? '✓' : ''}
              </span>
            )
          })}
          <input value={filtro} onChange={(e) => setFiltro(e.target.value)} placeholder="Buscar en el set…" className={`${CAMPO} ml-auto max-w-xs`} />
        </div>
        {datos.canciones.length > 0 && <DuracionTodas setId={setId} canciones={datos.canciones} onCambio={recargar} />}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase tracking-wide text-profundo/50">
              <tr>
                <th className="w-10 py-1">N°</th>
                <th className="py-1">Canción</th>
                <th className="w-24 py-1">Empieza (s)</th>
                <th className="w-24 py-1">Dura (s)</th>
                <th className="py-1">Título para el cartón</th>
                <th className="w-32 py-1" />
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: 90 }, (_, i) => i + 1)
                .filter((n) => {
                  if (!f) return true
                  const c = porNumero.get(n)
                  return String(n) === f || `${c?.titulo ?? ''} ${c?.artista ?? ''}`.toLowerCase().includes(f)
                })
                .map((n) => (
                  <FilaCancion
                    key={`${n}-${porNumero.get(n)?.catalog_item_id ?? ''}-${porNumero.get(n)?.inicio}-${porNumero.get(n)?.duracion}`}
                    setId={setId}
                    numero={n}
                    actual={porNumero.get(n)}
                    opciones={canciones}
                    impresa={n <= impresoHasta && porNumero.has(n)}
                    reimprimir={reimprimir.has(n)}
                    repetida={(usos.get(porNumero.get(n)?.catalog_item_id ?? '') ?? 0) > 1}
                    onCambio={recargar}
                  />
                ))}
            </tbody>
          </table>
        </div>
      </Tarjeta>
    </div>
  )
}

function NombreSet({ set, onCambio }: { set: SetBingo; onCambio: () => void }) {
  const [nombre, setNombre] = useState(set.name)
  const [falla, setFalla] = useState<string | null>(null)
  const navegar = useNavigate()
  return (
    <Tarjeta titulo="Set de bingo">
      <form
        onSubmit={(e) => {
          e.preventDefault()
          bingoAdmin.guardarSet({ id: set.id, name: nombre }).then(onCambio, (err) => setFalla(mensajeDe(err)))
        }}
        className="flex flex-wrap items-end gap-2"
      >
        <Etiqueta texto="Nombre" ayuda="(sale en los cartones)">
          <input value={nombre} onChange={(e) => setNombre(e.target.value)} maxLength={80} required className={CAMPO} />
        </Etiqueta>
        <BotonPrincipal>Guardar</BotonPrincipal>
        <BotonSecundario
          type="button"
          className="ml-auto"
          title="Copia con las mismas canciones, sin cartones"
          onClick={() => bingoAdmin.duplicarSet(set.id).then((id) => navegar(`/admin/bingo/${id}`), (err) => setFalla(mensajeDe(err)))}
        >
          Duplicar set
        </BotonSecundario>
        <BotonSecundario
          type="button"
          onClick={() => {
            if (window.confirm(`¿Borrar el set «${set.name}» con sus canciones y cartones?`)) {
              bingoAdmin.borrarSet(set.id).then(() => navegar('/admin/bingo'), (err) => setFalla(mensajeDe(err)))
            }
          }}
        >
          Borrar set
        </BotonSecundario>
      </form>
      {falla && (
        <div className="mt-2">
          <Mensaje>{falla}</Mensaje>
        </div>
      )}
    </Tarjeta>
  )
}

function Cartones({ setId, datos, onCambio }: { setId: string; datos: Datos; onCambio: () => void }) {
  const [cantidad, setCantidad] = useState<Record<TipoBingo, string>>({ express: '36', full: '36' })
  const [ocupado, setOcupado] = useState(false)
  const [msj, setMsj] = useState<{ ok: boolean; texto: string } | null>(null)

  const generar = async (tipo: TipoBingo) => {
    const n = Number(cantidad[tipo])
    const hay = datos.cartones.filter((c) => c.tipo === tipo).length
    if (!Number.isInteger(n) || n < 1 || n > 300) return setMsj({ ok: false, texto: 'La cantidad tiene que ser entre 1 y 300.' })
    if (hay > 0 && !window.confirm(`Ya hay ${hay} cartones ${FORMATO[tipo].nombre}. Si generás nuevos, los impresos dejan de servir. ¿Generar igual?`)) return
    setOcupado(true)
    setMsj(null)
    try {
      const k = await bingoAdmin.cartones(setId, tipo, generarCartones(tipo, n))
      setMsj({ ok: true, texto: `Listo: ${k} cartones ${FORMATO[tipo].nombre}. Imprimilos con «Imprimir».` })
      onCambio()
    } catch (e) {
      setMsj({ ok: false, texto: mensajeDe(e) })
    } finally {
      setOcupado(false)
    }
  }

  const reimpresos = async (tipo: TipoBingo) => {
    setOcupado(true)
    setMsj(null)
    try {
      await bingoAdmin.reimpresos(setId, tipo)
      onCambio()
    } catch (e) {
      setMsj({ ok: false, texto: mensajeDe(e) })
    } finally {
      setOcupado(false)
    }
  }

  return (
    <Tarjeta titulo="Cartones">
      <div className="grid gap-3 md:grid-cols-2">
        {TIPOS.map((t) => {
          const f = FORMATO[t]
          const hay = datos.cartones.filter((c) => c.tipo === t).length
          const pend = paraReimprimir(t, datos.canciones, datos.cartones, datos.set.impresos[t])
          return (
            <div key={t} className="rounded-xl border-2 border-profundo/10 p-3">
              <p className="font-bold">
                <span className="mr-2 rounded-lg bg-profundo px-2 py-0.5 font-titulo text-white">{f.letra}</span>
                {f.nombre} <span className="font-semibold text-profundo/60">· canciones 1 a {f.pool} · {f.minutos}</span>
              </p>
              <p className="my-2 text-sm text-profundo/70">
                {hay > 0 ? `${hay} cartones generados (${f.letra}-001 a ${f.letra}-${String(hay).padStart(3, '0')}).` : 'Sin cartones todavía.'}
              </p>
              <div className="flex flex-wrap items-end gap-2">
                <Etiqueta texto="Cantidad">
                  <input
                    value={cantidad[t]}
                    onChange={(e) => setCantidad((c) => ({ ...c, [t]: e.target.value.replace(/\D/g, '') }))}
                    inputMode="numeric"
                    className={`${CAMPO} w-24`}
                  />
                </Etiqueta>
                <BotonSecundario disabled={ocupado} onClick={() => void generar(t)}>
                  {hay > 0 ? 'Generar de nuevo' : 'Generar'}
                </BotonSecundario>
                {hay > 0 && (
                  <a href={`/admin/bingo/${setId}/imprimir/${t}`} target="_blank" rel="noopener">
                    <BotonPrincipal type="button">Imprimir ↗</BotonPrincipal>
                  </a>
                )}
              </div>
              {pend.cartones.length > 0 && (
                <div className="mt-3 rounded-xl bg-naranja/10 p-3 text-sm">
                  <p className="font-bold">
                    🖨 Para reimprimir: {pend.cartones.length} {pend.cartones.length === 1 ? 'cartón' : 'cartones'}
                  </p>
                  <p className="mb-2 text-profundo/70">
                    {pend.numeros.length === 1 ? 'Cambió la canción' : 'Cambiaron las canciones'} {pend.numeros.join(', ')} después de
                    imprimir. Los números del cartón no cambian: reimprimí solo esos y reemplazalos.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <a href={`/admin/bingo/${setId}/imprimir/${t}?solo=cambiados`} target="_blank" rel="noopener">
                      <BotonPrincipal type="button">Imprimir solo esos ↗</BotonPrincipal>
                    </a>
                    <BotonSecundario disabled={ocupado} onClick={() => void reimpresos(t)}>
                      Ya los reimprimí
                    </BotonSecundario>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
      {msj && (
        <div className="mt-3">
          <Mensaje tipo={msj.ok ? 'ok' : 'error'}>{msj.texto}</Mensaje>
        </div>
      )}
    </Tarjeta>
  )
}

/** La misma duración para todas las canciones del set, de una vez (el inicio de cada una no se toca). */
function DuracionTodas({ setId, canciones, onCambio }: { setId: string; canciones: CancionSet[]; onCambio: () => void }) {
  const distintas = [...new Set(canciones.map((c) => c.duracion))]
  const [dura, setDura] = useState(String(distintas.length === 1 ? distintas[0] : 15))
  const [msj, setMsj] = useState<{ ok: boolean; texto: string } | null>(null)

  const aplicar = async (e: FormEvent) => {
    e.preventDefault()
    const n = Number(dura)
    if (!window.confirm(`¿Poner ${n} segundos a las ${canciones.length} canciones del set?`)) return
    setMsj(null)
    try {
      const k = await bingoAdmin.duracionTodas(setId, n)
      setMsj({ ok: true, texto: `Listo: ${k} canciones con ${n} s.` })
      onCambio()
    } catch (err) {
      setMsj({ ok: false, texto: mensajeDe(err) })
    }
  }

  return (
    <form onSubmit={aplicar} className="mb-3 flex flex-wrap items-center gap-2 rounded-xl bg-crema px-3 py-2 text-sm">
      <span className="font-semibold">Duración para todas:</span>
      <input value={dura} onChange={(e) => setDura(e.target.value.replace(/\D/g, '').slice(0, 3))} inputMode="numeric" required className="w-16 rounded-lg border-2 border-profundo/15 px-2 py-1" />
      <span>segundos</span>
      <button className="rounded-lg bg-naranja px-3 py-1 font-semibold text-white">Aplicar a todas</button>
      <span className="text-profundo/60">{distintas.length === 1 ? `Ahora todas duran ${distintas[0]} s.` : 'Ahora hay duraciones distintas.'}</span>
      {msj && <span className={`font-bold ${msj.ok ? 'text-green-700' : 'text-naranja'}`}>{msj.texto}</span>}
    </form>
  )
}

type PropsFila = {
  setId: string
  numero: number
  actual: CancionSet | undefined
  opciones: { id: string; texto: string }[]
  /** Está en cartones generados: cambiar la canción o el título obliga a reimprimirlos. */
  impresa: boolean
  reimprimir: boolean
  repetida: boolean
  onCambio: () => void
}

function FilaCancion({ setId, numero, actual, opciones, impresa, reimprimir, repetida, onCambio }: PropsFila) {
  const [item, setItem] = useState(actual?.catalog_item_id ?? '')
  const [inicio, setInicio] = useState(String(actual?.inicio ?? 0))
  const [dura, setDura] = useState(String(actual?.duracion ?? 15))
  const [corto, setCorto] = useState(actual?.titulo_carton ?? '')
  const [estado, setEstado] = useState<{ ok: boolean; texto: string } | null>(null)
  const cambio =
    item !== (actual?.catalog_item_id ?? '') ||
    inicio !== String(actual?.inicio ?? 0) ||
    dura !== String(actual?.duracion ?? 15) ||
    corto !== (actual?.titulo_carton ?? '')

  const guardar = async () => {
    const cambiaCarton = item !== actual?.catalog_item_id || corto !== (actual?.titulo_carton ?? '')
    if (
      impresa &&
      cambiaCarton &&
      !window.confirm(
        `El número ${numero} está en cartones impresos. Si cambiás la canción o su título, vas a tener que reimprimir los cartones que lo tienen (los números no cambian). ¿Seguir?`,
      )
    )
      return
    setEstado(null)
    try {
      await bingoAdmin.cancion({ set_id: setId, number: numero, catalog_item_id: item, inicio: Number(inicio || 0), duracion: Number(dura || 15), titulo_carton: corto })
      onCambio()
    } catch (e) {
      setEstado({ ok: false, texto: mensajeDe(e) })
    }
  }

  return (
    <tr className={`border-t border-profundo/10 align-top ${repetida ? 'bg-naranja/10' : ''}`}>
      <td className="py-1.5 font-titulo text-base font-bold">{numero}</td>
      <td className="py-1.5 pr-2">
        <select value={item} onChange={(e) => setItem(e.target.value)} className="w-full rounded-lg border-2 border-profundo/15 px-2 py-1">
          <option value="">— elegir canción —</option>
          {opciones.map((o) => (
            <option key={o.id} value={o.id}>
              {o.texto}
            </option>
          ))}
        </select>
        {repetida && <p className="text-xs font-bold text-naranja">Esta canción está en otro número del set.</p>}
        {reimprimir ? (
          <p className="text-xs font-bold text-naranja">🖨 Cambió después de imprimir: reimprimí sus cartones</p>
        ) : (
          impresa && <p className="text-xs text-profundo/50">🖨 En cartones impresos</p>
        )}
        {estado && <p className={`text-xs font-bold ${estado.ok ? 'text-green-700' : 'text-naranja'}`}>{estado.texto}</p>}
      </td>
      <td className="py-1.5 pr-2">
        <input value={inicio} onChange={(e) => setInicio(e.target.value.replace(/\D/g, ''))} inputMode="numeric" className="w-20 rounded-lg border-2 border-profundo/15 px-2 py-1" />
      </td>
      <td className="py-1.5 pr-2">
        <input value={dura} onChange={(e) => setDura(e.target.value.replace(/\D/g, ''))} inputMode="numeric" className="w-20 rounded-lg border-2 border-profundo/15 px-2 py-1" />
      </td>
      <td className="py-1.5 pr-2">
        <input value={corto} onChange={(e) => setCorto(e.target.value)} maxLength={40} placeholder={actual?.titulo} className="w-full rounded-lg border-2 border-profundo/15 px-2 py-1" />
      </td>
      <td className="whitespace-nowrap py-1.5 text-right">
        {actual?.youtube_id && (
          <a
            href={`https://www.youtube.com/watch?v=${actual.youtube_id}&t=${actual.inicio}s`}
            target="_blank"
            rel="noopener noreferrer"
            className="mr-2 font-bold text-azul"
            title="Escuchar desde el estribillo"
          >
            ▶
          </a>
        )}
        {cambio && item && (
          <button onClick={() => void guardar()} className="rounded-lg bg-naranja px-3 py-1 font-semibold text-white">
            Guardar
          </button>
        )}
        {!cambio && actual && !impresa && (
          <button
            onClick={() => bingoAdmin.quitarCancion(setId, numero).then(onCambio, (e) => setEstado({ ok: false, texto: mensajeDe(e) }))}
            className="px-1 text-naranja"
            aria-label={`Sacar la canción del número ${numero}`}
          >
            ✕
          </button>
        )}
      </td>
    </tr>
  )
}
