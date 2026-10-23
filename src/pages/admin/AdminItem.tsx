import { useMemo, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useCatalogo, type ItemCatalogo } from '../../admin/useCatalogo'
import { BotonPrincipal, BotonSecundario, CAMPO, Etiqueta, Mensaje, Tarjeta } from '../../admin/ui'
import { SubirImagen } from '../../admin/SubirImagen'
import { PruebaFragmento, VistaPrevia } from '../../admin/VistaPrevia'
import { idDeYouTube, NOMBRE_TIPO, TIPOS, validarItem, type TipoItem } from '../../content/validarItem'
import { letraOpcion } from '../../dynamics/solucion'
import { ErrorRpc } from '../../lib/rpc'
import { admin } from '../../lib/rpcAdmin'

/** /admin/catalogo/:itemId — alta ("nuevo?tipo=…") o edición de un ítem, con vista previa. */
export default function AdminItem() {
  const { itemId = 'nuevo' } = useParams()
  const [busqueda] = useSearchParams()
  const { items, error } = useCatalogo()
  if (error) return <Mensaje>{error}</Mensaje>
  if (itemId !== 'nuevo' && !items) return <p className="text-profundo/70">Cargando…</p>
  const item = items?.find((i) => i.id === itemId) ?? null
  if (itemId !== 'nuevo' && !item) return <Mensaje>No encontramos ese ítem. Puede que lo hayan borrado.</Mensaje>
  const tipo = (item?.type ?? busqueda.get('tipo') ?? 'pregunta_opciones') as TipoItem
  return <Formulario key={itemId} item={item} tipoInicial={TIPOS.includes(tipo) ? tipo : 'pregunta_opciones'} />
}

type Campos = {
  texto: string
  opciones: string[]
  correcta: number
  afirmaciones: string[]
  mentira: number
  unidad: string
  formato: 'numero' | 'anio'
  valor: string
  explicacion: string
  imagen: string
  youtube: string
  inicio: string
  duracion: string
  categoria: string
  anio: string
  titulo: string
  artista: string
  variantesTitulo: string
  variantesArtista: string
  estilo: 'emojis' | 'logo' | 'que_ves'
  emojis: string
  consigna: string
  respuesta: string
  variantesRespuesta: string
  nombre: string
  repetir: boolean
  etiquetas: string
  dificultad: string
  estado: 'aprobado' | 'sugerido' | 'borrador'
}

const str = (v: unknown) => (typeof v === 'string' ? v : typeof v === 'number' ? String(v) : '')
const lista = (v: unknown) => (Array.isArray(v) ? v.map(String) : [])

function camposDe(item: ItemCatalogo | null, tipo: TipoItem): Campos {
  const c = item?.content ?? {}
  const s = item?.solution ?? {}
  return {
    texto: str(c.texto),
    opciones: lista(c.opciones).length ? lista(c.opciones) : ['', '', '', ''],
    correcta: Number(s.correcta ?? 0),
    afirmaciones: lista(c.afirmaciones).length === 3 ? lista(c.afirmaciones) : ['', '', ''],
    mentira: Number(s.mentira ?? 0),
    unidad: str(c.unidad),
    formato: c.formato === 'anio' ? 'anio' : 'numero',
    valor: str(s.valor).replace('.', ','),
    explicacion: str(s.explicacion),
    imagen: str(c.imagen),
    youtube: str(c.youtube_id),
    inicio: str(c.inicio ?? 0),
    duracion: str(c.duracion ?? (tipo === 'sonido' ? '' : 20)),
    categoria: str(c.categoria ?? (tipo === 'clip_video' ? 'pelicula' : 'musica')),
    anio: str(s.anio),
    titulo: str(s.titulo),
    artista: str(s.artista),
    variantesTitulo: lista(s.variantes_titulo).join('\n'),
    variantesArtista: lista(s.variantes_artista).join('\n'),
    estilo: c.estilo === 'logo' || c.estilo === 'que_ves' ? c.estilo : 'emojis',
    emojis: str(c.emojis),
    consigna: str(c.consigna),
    respuesta: str(s.respuesta),
    variantesRespuesta: lista(s.variantes_respuesta).join('\n'),
    nombre: tipo === 'sonido' ? str(c.titulo) : '',
    repetir: c.repetir === true,
    etiquetas: (item?.tags ?? []).join(', '),
    dificultad: item?.difficulty ?? '',
    estado: item?.status ?? 'aprobado',
  }
}

const numero = (t: string) => (t.trim() === '' ? undefined : Number(t.trim().replace(/\./g, '').replace(',', '.')))
const entero = (t: string) => (t.trim() === '' ? undefined : Number(t.trim()))
const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
const lineas = (t: string) => t.split(/\n|\|/).map((x) => x.trim()).filter(Boolean)

/** Arma content y solution con la forma que espera la base (spec §5). */
function armar(tipo: TipoItem, f: Campos): { contenido: Record<string, unknown>; solucion: Record<string, unknown> } {
  const explicacion = f.explicacion.trim() ? { explicacion: f.explicacion.trim() } : {}
  switch (tipo) {
    case 'pregunta_opciones':
      return {
        contenido: { texto: f.texto.trim(), opciones: f.opciones.map((o) => o.trim()), ...(f.imagen.trim() ? { imagen: f.imagen.trim() } : {}) },
        solucion: { correcta: f.correcta, ...explicacion },
      }
    case 'trio_verdad_mentira':
      return { contenido: { afirmaciones: f.afirmaciones.map((o) => o.trim()) }, solucion: { mentira: f.mentira, ...explicacion } }
    case 'pregunta_numerica':
      return {
        contenido: { texto: f.texto.trim(), unidad: f.unidad.trim(), imagen: f.imagen.trim() || null, formato: f.formato },
        solucion: { valor: numero(f.valor), ...explicacion },
      }
    case 'imagen_adivinar':
      return {
        contenido: {
          estilo: f.estilo,
          ...(f.estilo === 'emojis' ? { emojis: f.emojis.trim() } : { imagen: f.imagen.trim() }),
          ...(f.consigna.trim() ? { consigna: f.consigna.trim() } : {}),
        },
        solucion: { respuesta: f.respuesta.trim(), variantes_respuesta: lineas(f.variantesRespuesta), ...explicacion },
      }
    case 'pregunta_mayoria':
      return { contenido: { texto: f.texto.trim() }, solucion: {} }
    case 'sonido':
      return {
        contenido: {
          titulo: f.nombre.trim(),
          youtube_id: idDeYouTube(f.youtube),
          inicio: entero(f.inicio) ?? 0,
          ...(f.duracion.trim() ? { duracion: entero(f.duracion) } : {}),
          repetir: f.repetir,
        },
        solucion: {},
      }
    default:
      return {
        // Por defecto desde 0:00; se puede arrancar más adelante (el proyector entra con volumen suave).
        contenido: { youtube_id: idDeYouTube(f.youtube), inicio: entero(f.inicio) ?? 0, duracion: entero(f.duracion) ?? 20, categoria: f.categoria },
        solucion: {
          anio: entero(f.anio),
          titulo: f.titulo.trim(),
          ...(f.artista.trim() ? { artista: f.artista.trim() } : {}),
          variantes_titulo: lineas(f.variantesTitulo),
          variantes_artista: lineas(f.variantesArtista),
        },
      }
  }
}

function Formulario({ item, tipoInicial }: { item: ItemCatalogo | null; tipoInicial: TipoItem }) {
  const navegar = useNavigate()
  const [tipo, setTipo] = useState<TipoItem>(tipoInicial)
  const [f, setF] = useState<Campos>(() => camposDe(item, tipoInicial))
  const [enviando, setEnviando] = useState(false)
  const [mensaje, setMensaje] = useState<{ ok: boolean; texto: string } | null>(null)
  const poner = <K extends keyof Campos>(k: K, v: Campos[K]) => setF((x) => ({ ...x, [k]: v }))
  const { contenido, solucion } = useMemo(() => armar(tipo, f), [tipo, f])
  const problema = validarItem(tipo, contenido, solucion)
  const esMedia = tipo === 'pista_audio' || tipo === 'clip_video'

  async function guardar(e: FormEvent) {
    e.preventDefault()
    if (problema) return setMensaje({ ok: false, texto: problema })
    setEnviando(true)
    setMensaje(null)
    try {
      const id = await admin.saveItem({
        id: item?.id,
        type: tipo,
        content: contenido,
        solution: solucion,
        status: f.estado,
        difficulty: f.dificultad,
        tags: f.etiquetas.split(',').map((t) => t.trim()).filter(Boolean),
      })
      if (!item) navegar(`/admin/catalogo/${id}`, { replace: true })
      setMensaje({ ok: true, texto: 'Guardado.' })
    } catch (err) {
      setMensaje({ ok: false, texto: err instanceof ErrorRpc ? err.message : 'No se pudo guardar.' })
    } finally {
      setEnviando(false)
    }
  }

  const listaEditable = (k: 'opciones' | 'afirmaciones', marca: 'correcta' | 'mentira', etiqueta: (i: number) => string, fija: boolean) => (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-1 text-sm font-bold">
        {k === 'opciones' ? 'Opciones' : 'Afirmaciones'} <span className="font-semibold text-profundo/50">(marcá la {marca})</span>
      </legend>
      {f[k].map((o, i) => (
        <div key={i} className="flex items-center gap-2">
          <input type="radio" name={marca} checked={f[marca] === i} onChange={() => poner(marca, i)} className="h-5 w-5" aria-label={`Marcar ${etiqueta(i)} como ${marca}`} />
          <span className="w-6 font-titulo font-bold">{etiqueta(i)}</span>
          <input
            value={o}
            onChange={(e) => poner(k, f[k].map((x, j) => (j === i ? e.target.value : x)))}
            className={CAMPO}
            maxLength={200}
          />
          {!fija && f[k].length > 2 && (
            <button
              type="button"
              onClick={() => {
                poner(k, f[k].filter((_, j) => j !== i))
                if (f[marca] >= i && f[marca] > 0) poner(marca, f[marca] - 1)
              }}
              className="px-2 text-naranja"
              aria-label="Sacar opción"
            >
              ✕
            </button>
          )}
        </div>
      ))}
      {!fija && f[k].length < 6 && (
        <button type="button" onClick={() => poner(k, [...f[k], ''])} className="self-start text-sm font-semibold text-azul underline">
          + Agregar opción
        </button>
      )}
    </fieldset>
  )

  return (
    <div className="flex flex-col gap-4">
      <Link to="/admin/catalogo" className="text-sm font-semibold text-azul">
        ← Catálogo
      </Link>
      <div className="grid gap-4 lg:grid-cols-[1.1fr_1fr]">
        <Tarjeta titulo={item ? 'Editar ítem' : 'Nuevo ítem'}>
          <form onSubmit={guardar} className="flex flex-col gap-3">
            <Etiqueta texto="Tipo">
              <select value={tipo} onChange={(e) => setTipo(e.target.value as TipoItem)} disabled={Boolean(item?.used_in_events.length)} className={CAMPO}>
                {TIPOS.map((t) => (
                  <option key={t} value={t}>
                    {NOMBRE_TIPO[t]}
                  </option>
                ))}
              </select>
            </Etiqueta>

            {(tipo === 'pregunta_opciones' || tipo === 'pregunta_numerica' || tipo === 'pregunta_mayoria') && (
              <Etiqueta texto="Pregunta">
                <textarea value={f.texto} onChange={(e) => poner('texto', e.target.value)} rows={2} maxLength={300} className={`${CAMPO} py-2`} />
              </Etiqueta>
            )}
            {tipo === 'pregunta_mayoria' && (
              <p className="text-sm text-profundo/70">
                No tiene respuesta correcta: suman las mesas que coinciden con la mayoría. Funciona mejor con preguntas abiertas y
                cortas («¿La mejor comida para un domingo?»).
              </p>
            )}
            {tipo === 'imagen_adivinar' && (
              <>
                <Etiqueta texto="Juego">
                  <select value={f.estilo} onChange={(e) => poner('estilo', e.target.value as Campos['estilo'])} className={CAMPO}>
                    <option value="emojis">Película con emojis</option>
                    <option value="logo">Logo (¿de qué marca es?)</option>
                    <option value="que_ves">¿Qué ves? (acertijo de imagen)</option>
                  </select>
                </Etiqueta>
                {f.estilo === 'emojis' ? (
                  <Etiqueta texto="Emojis" ayuda="(pegalos o escribilos con Windows + punto)">
                    <input value={f.emojis} onChange={(e) => poner('emojis', e.target.value)} placeholder="🦁👑" className={`${CAMPO} text-2xl`} />
                  </Etiqueta>
                ) : (
                  <SubirImagen url={f.imagen} onCambio={(u) => poner('imagen', u)} />
                )}
                <Etiqueta texto="Consigna" ayuda="(opcional; si no, «¿Qué película es?», «¿De qué marca es este logo?» o «¿Qué ves?»)">
                  <input value={f.consigna} onChange={(e) => poner('consigna', e.target.value)} maxLength={120} className={CAMPO} />
                </Etiqueta>
                <div className="grid gap-3 md:grid-cols-2">
                  <Etiqueta texto="Respuesta">
                    <input value={f.respuesta} onChange={(e) => poner('respuesta', e.target.value)} maxLength={150} className={CAMPO} />
                  </Etiqueta>
                  <Etiqueta texto="Otras formas aceptadas" ayuda="(una por línea)">
                    <textarea value={f.variantesRespuesta} onChange={(e) => poner('variantesRespuesta', e.target.value)} rows={2} className={`${CAMPO} py-2`} />
                  </Etiqueta>
                </div>
              </>
            )}
            {tipo === 'pregunta_opciones' && listaEditable('opciones', 'correcta', letraOpcion, false)}
            {tipo === 'trio_verdad_mentira' && listaEditable('afirmaciones', 'mentira', (i) => String(i + 1), true)}
            {tipo === 'pregunta_numerica' && (
              <div className="grid gap-3 md:grid-cols-3">
                <Etiqueta texto="Se responde con">
                  <select value={f.formato} onChange={(e) => poner('formato', e.target.value as 'numero' | 'anio')} className={CAMPO}>
                    <option value="numero">un número</option>
                    <option value="anio">un año</option>
                  </select>
                </Etiqueta>
                <Etiqueta texto="Valor correcto">
                  <input value={f.valor} onChange={(e) => poner('valor', e.target.value)} inputMode="decimal" className={CAMPO} />
                </Etiqueta>
                <Etiqueta texto="Unidad" ayuda="(opcional)">
                  <input value={f.unidad} onChange={(e) => poner('unidad', e.target.value)} placeholder="metros" maxLength={30} className={CAMPO} />
                </Etiqueta>
              </div>
            )}

            {tipo === 'sonido' && (
              <>
                <p className="text-sm text-profundo/70">
                  Música o efecto para prender y apagar a mano desde Conducir (música de fondo, redoblante, aplausos). Suena en el
                  proyector. No va en los bloques de juego.
                </p>
                <Etiqueta texto="Nombre" ayuda="(para reconocerlo en el panel)">
                  <input value={f.nombre} onChange={(e) => poner('nombre', e.target.value)} maxLength={80} placeholder="Ej.: Música de pausa" className={CAMPO} />
                </Etiqueta>
                <Etiqueta texto="Video de YouTube" ayuda="(link o id de 11 caracteres)">
                  <input value={f.youtube} onChange={(e) => poner('youtube', e.target.value)} placeholder="https://www.youtube.com/watch?v=…" className={CAMPO} />
                </Etiqueta>
                <div className="grid gap-3 md:grid-cols-3">
                  <Etiqueta texto="Empieza en (s)" ayuda="(0 = desde el principio)">
                    <input value={f.inicio} onChange={(e) => poner('inicio', e.target.value.replace(/\D/g, '').slice(0, 5))} inputMode="numeric" className={CAMPO} />
                  </Etiqueta>
                  <Etiqueta texto="Dura (s)" ayuda="(vacío = hasta el final)">
                    <input value={f.duracion} onChange={(e) => poner('duracion', e.target.value.replace(/\D/g, '').slice(0, 4))} inputMode="numeric" className={CAMPO} />
                  </Etiqueta>
                  <label className="flex min-h-toque items-center gap-2 self-end font-semibold">
                    <input type="checkbox" checked={f.repetir} onChange={(e) => poner('repetir', e.target.checked)} className="h-5 w-5" />
                    Repetir en bucle
                  </label>
                </div>
                <PruebaFragmento youtubeId={idDeYouTube(f.youtube)} inicio={entero(f.inicio) ?? 0} duracion={entero(f.duracion) ?? 30} />
              </>
            )}

            {esMedia && (
              <>
                <Etiqueta texto="Video de YouTube" ayuda="(link o id de 11 caracteres)">
                  <input value={f.youtube} onChange={(e) => poner('youtube', e.target.value)} placeholder="https://www.youtube.com/watch?v=…" className={CAMPO} />
                </Etiqueta>
                <div className="grid gap-3 md:grid-cols-3">
                  <Etiqueta texto="Empieza en (s)" ayuda={`(${mmss(entero(f.inicio) ?? 0)}; 0 = desde el principio)`}>
                    <input value={f.inicio} onChange={(e) => poner('inicio', e.target.value.replace(/\D/g, '').slice(0, 5))} inputMode="numeric" className={CAMPO} />
                  </Etiqueta>
                  <Etiqueta texto={tipo === 'clip_video' ? 'Dura (s)' : 'Suenan (s)'}>
                    <input value={f.duracion} onChange={(e) => poner('duracion', e.target.value.replace(/\D/g, ''))} inputMode="numeric" className={CAMPO} />
                  </Etiqueta>
                  <Etiqueta texto="Categoría">
                    <select value={f.categoria} onChange={(e) => poner('categoria', e.target.value)} className={CAMPO}>
                      <option value="musica">Música</option>
                      <option value="pelicula">Película</option>
                      <option value="serie">Serie</option>
                      <option value="dibujo">Dibujo animado</option>
                    </select>
                  </Etiqueta>
                </div>
                {(entero(f.inicio) ?? 0) > 0 && (
                  <p className="text-sm text-profundo/70">
                    Arranca en {mmss(entero(f.inicio) ?? 0)}: en el proyector entra con el volumen suave. Usalo para saltear un comienzo que
                    delata el nombre.
                  </p>
                )}
                <PruebaFragmento youtubeId={idDeYouTube(f.youtube)} inicio={entero(f.inicio) ?? 0} duracion={entero(f.duracion) ?? 20} />
                <div className="grid gap-3 md:grid-cols-[0.5fr_1fr_1fr]">
                  <Etiqueta texto="Año">
                    <input value={f.anio} onChange={(e) => poner('anio', e.target.value.replace(/\D/g, '').slice(0, 4))} inputMode="numeric" className={CAMPO} />
                  </Etiqueta>
                  <Etiqueta texto="Título">
                    <input value={f.titulo} onChange={(e) => poner('titulo', e.target.value)} maxLength={150} className={CAMPO} />
                  </Etiqueta>
                  <Etiqueta texto={tipo === 'clip_video' ? 'Director o directora' : 'Artista'}>
                    <input value={f.artista} onChange={(e) => poner('artista', e.target.value)} maxLength={150} className={CAMPO} />
                  </Etiqueta>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <Etiqueta texto="Otras formas del título" ayuda="(una por línea; también se aceptan)">
                    <textarea value={f.variantesTitulo} onChange={(e) => poner('variantesTitulo', e.target.value)} rows={2} className={`${CAMPO} py-2`} />
                  </Etiqueta>
                  <Etiqueta texto={tipo === 'clip_video' ? 'Otras formas del director' : 'Otras formas del artista'} ayuda="(una por línea)">
                    <textarea value={f.variantesArtista} onChange={(e) => poner('variantesArtista', e.target.value)} rows={2} className={`${CAMPO} py-2`} />
                  </Etiqueta>
                </div>
              </>
            )}

            {!esMedia && tipo !== 'pregunta_mayoria' && tipo !== 'sonido' && (
              <Etiqueta texto="Explicación" ayuda="(opcional, se muestra al revelar)">
                <input value={f.explicacion} onChange={(e) => poner('explicacion', e.target.value)} maxLength={200} className={CAMPO} />
              </Etiqueta>
            )}

            <div className="grid gap-3 md:grid-cols-3">
              <Etiqueta texto="Etiquetas" ayuda="(separadas por coma)">
                <input value={f.etiquetas} onChange={(e) => poner('etiquetas', e.target.value)} placeholder="80s, rock nacional" className={CAMPO} />
              </Etiqueta>
              <Etiqueta texto="Dificultad">
                <select value={f.dificultad} onChange={(e) => poner('dificultad', e.target.value)} className={CAMPO}>
                  <option value="">—</option>
                  <option value="facil">Fácil</option>
                  <option value="media">Media</option>
                  <option value="dificil">Difícil</option>
                </select>
              </Etiqueta>
              <Etiqueta texto="Estado">
                <select value={f.estado} onChange={(e) => poner('estado', e.target.value as Campos['estado'])} className={CAMPO}>
                  <option value="aprobado">Aprobado</option>
                  <option value="sugerido">Sugerido (a revisar)</option>
                  <option value="borrador">Borrador</option>
                </select>
              </Etiqueta>
            </div>

            {problema && <p className="text-sm font-semibold text-naranja">Falta algo: {problema}</p>}
            {mensaje && <Mensaje tipo={mensaje.ok ? 'ok' : 'error'}>{mensaje.texto}</Mensaje>}
            <div className="flex gap-2">
              <BotonPrincipal disabled={enviando || Boolean(problema)}>{enviando ? 'Guardando…' : 'Guardar'}</BotonPrincipal>
              <BotonSecundario type="button" onClick={() => navegar('/admin/catalogo')}>
                Volver
              </BotonSecundario>
            </div>
          </form>
        </Tarjeta>

        <Tarjeta>
          {tipo === 'sonido' ? (
            <p className="text-profundo/70">Se escucha en el proyector cuando lo prendés desde Conducir. Probalo con el botón de prueba.</p>
          ) : (
            <VistaPrevia tipo={tipo} contenido={contenido} solucion={solucion} />
          )}
        </Tarjeta>
      </div>
    </div>
  )
}
