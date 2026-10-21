import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { resumenItem } from '../../admin/useCatalogo'
import { BotonPrincipal, BotonSecundario, CAMPO, Etiqueta, Mensaje, Tarjeta } from '../../admin/ui'
import { leerImportacion, type FilaImportada } from '../../content/importar'
import { NOMBRE_TIPO, TIPOS_POR_DINAMICA, type TipoItem } from '../../content/validarItem'
import { metaDe } from '../../dynamics/registro'
import { ErrorRpc } from '../../lib/rpc'
import { admin } from '../../lib/rpcAdmin'
import { supabase } from '../../lib/supabase'
import guia from '../../../docs/GUIA_CATALOGO.md?raw'

type BloqueDestino = { id: string; title: string; dynamic: string; position: number; event: { name: string; code: string } | null }

const EJEMPLO = [
  {
    tipo: 'pregunta_opciones',
    etiquetas: ['variada'],
    dificultad: 'facil',
    contenido: { texto: '¿Cuántas piezas tiene un dominó clásico?', opciones: ['28', '32', '24', '36'] },
    solucion: { correcta: 0, explicacion: 'Doble seis: 28 fichas.' },
  },
  {
    tipo: 'pista_audio',
    etiquetas: ['80s', 'rock nacional'],
    contenido: { youtube_id: 'XXXXXXXXXXX', inicio: 42, duracion: 20, categoria: 'musica' },
    solucion: { anio: 1986, titulo: 'Persiana americana', artista: 'Soda Stereo', variantes_titulo: [], variantes_artista: ['Soda'] },
  },
  {
    tipo: 'imagen_adivinar',
    etiquetas: ['disney'],
    contenido: { estilo: 'emojis', emojis: '🦁👑' },
    solucion: { respuesta: 'El rey león', variantes_respuesta: ['Rey León'] },
  },
  {
    tipo: 'imagen_adivinar',
    etiquetas: ['marcas'],
    contenido: { estilo: 'logo', imagen: 'https://…/logo.png' },
    solucion: { respuesta: 'Nombre de la marca', variantes_respuesta: [] },
  },
  {
    tipo: 'pregunta_mayoria',
    etiquetas: ['oveja'],
    contenido: { texto: '¿Cuál es la mejor comida para un domingo?' },
    solucion: {},
  },
]

function descargar(contenido: string, nombre: string, tipo: string) {
  const url = URL.createObjectURL(new Blob([contenido], { type: `${tipo};charset=utf-8` }))
  const a = document.createElement('a')
  a.href = url
  a.download = nombre
  a.click()
  URL.revokeObjectURL(url)
}

/** /admin/importar — JSON o CSV → vista previa con errores por fila → importar (y opcionalmente a un bloque). */
export default function AdminImportar() {
  const [texto, setTexto] = useState('')
  const [nombreArchivo, setNombreArchivo] = useState<string | null>(null)
  // Por defecto, sugeridos: lo que viene de afuera (por ejemplo, de una IA) se revisa en el catálogo antes de usarlo.
  const [copiado, setCopiado] = useState(false)
  const [estado, setEstado] = useState<'aprobado' | 'sugerido'>('sugerido')
  const [bloqueId, setBloqueId] = useState('')
  const [bloques, setBloques] = useState<BloqueDestino[]>([])
  const [enviando, setEnviando] = useState(false)
  const [resultado, setResultado] = useState<{ ok: boolean; texto: string } | null>(null)
  const [erroresBase, setErroresBase] = useState<Record<number, string>>({})

  useEffect(() => {
    supabase
      .from('event_blocks')
      .select('id, title, dynamic, position, event:events(name, code)')
      .order('position')
      .then(({ data }) => setBloques((data as unknown as BloqueDestino[]) ?? []))
  }, [])

  const { filas, error } = texto.trim() ? leerImportacion(texto) : { filas: [] as FilaImportada[], error: null }
  const bloque = bloques.find((b) => b.id === bloqueId)
  const tiposBloque = bloque ? (TIPOS_POR_DINAMICA[bloque.dynamic] ?? []) : null
  const errorDe = (f: FilaImportada) =>
    f.error ??
    erroresBase[f.fila] ??
    (tiposBloque && f.item && !tiposBloque.includes(f.item.tipo as TipoItem) ? `Un ítem «${f.item.tipo}» no va en un bloque de ${bloque?.dynamic}.` : null)
  const conError = filas.filter((f) => errorDe(f)).length
  const validas = filas.length - conError

  async function leerArchivo(archivo: File | undefined) {
    if (!archivo) return
    setNombreArchivo(archivo.name)
    setResultado(null)
    setErroresBase({})
    setTexto(await archivo.text())
  }

  async function importar() {
    setEnviando(true)
    setResultado(null)
    try {
      const r = await admin.importItems(
        filas.map((f) => f.item),
        estado,
        bloqueId || null,
      )
      if (r.errores?.length) {
        setErroresBase(Object.fromEntries(r.errores.map((e) => [e.fila, e.error])))
        setResultado({ ok: false, texto: 'La base encontró errores: no se importó nada. Corregí las filas marcadas.' })
      } else {
        setResultado({
          ok: true,
          texto: `Listo: se importaron ${r.importados} ítems${bloque ? ` y se agregaron a «${bloque.title}» (${bloque.event?.name})` : ''}.`,
        })
        setTexto('')
        setNombreArchivo(null)
      }
    } catch (e) {
      setResultado({ ok: false, texto: e instanceof ErrorRpc ? e.message : 'No se pudo importar.' })
    } finally {
      setEnviando(false)
    }
  }

  /** La guía para generar el catálogo con una IA (docs/GUIA_CATALOGO.md, la misma del proyecto). */
  function bajarGuia() {
    descargar(guia, 'guia-catalogo-familia-ludica.md', 'text/markdown')
  }

  /** Los errores de la vista previa, listos para pegarle a la IA que armó el archivo. */
  async function copiarErrores() {
    const lineas = error ? [error] : filas.filter((f) => errorDe(f)).map((f) => `Fila ${f.fila}: ${errorDe(f)}`)
    const textoIA = [
      'La app de Familia Lúdica encontró estos errores en el JSON (las filas se cuentan desde 1, en el orden de la lista).',
      'Corregí solo esas filas siguiendo la guía y devolveme el JSON completo:',
      ...lineas,
    ].join('\n')
    try {
      await navigator.clipboard.writeText(textoIA)
      setCopiado(true)
      window.setTimeout(() => setCopiado(false), 3000)
    } catch {
      window.prompt('Copiá este texto:', textoIA)
    }
  }

  function bajarEjemplo() {
    descargar(JSON.stringify(EJEMPLO, null, 2), 'ejemplo-familia-ludica.json', 'application/json')
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-3xl font-bold">Importar contenido</h1>
      <Tarjeta
        titulo="1. El archivo"
        acciones={
          <>
            <BotonSecundario onClick={bajarGuia}>Bajar guía para IA</BotonSecundario>
            <BotonSecundario onClick={bajarEjemplo}>Bajar un ejemplo (JSON)</BotonSecundario>
          </>
        }
      >
        <p className="mb-3 text-sm text-profundo/70">
          JSON: una lista de ítems con <code>tipo, etiquetas, dificultad, contenido, solucion</code>. CSV: columnas{' '}
          <code>tipo, etiquetas</code> (separadas por |), <code>dificultad, contenido_json, solucion_json</code>.
        </p>
        <div className="flex flex-col gap-3">
          <input type="file" accept=".json,.csv,application/json,text/csv" onChange={(e) => void leerArchivo(e.target.files?.[0])} />
          {nombreArchivo && <p className="text-sm font-semibold">Archivo: {nombreArchivo}</p>}
          <Etiqueta texto="…o pegalo acá">
            <textarea
              value={texto}
              onChange={(e) => {
                setTexto(e.target.value)
                setNombreArchivo(null)
                setResultado(null)
                setErroresBase({})
              }}
              rows={6}
              className={`${CAMPO} py-2 font-mono text-xs`}
              placeholder='[ { "tipo": "pregunta_opciones", … } ]'
            />
          </Etiqueta>
        </div>
      </Tarjeta>

      {(filas.length > 0 || error) && (
        <Tarjeta
          titulo={`2. Vista previa · ${validas} bien${conError ? ` · ${conError} con errores` : ''}`}
          acciones={
            (conError > 0 || error) && (
              <BotonSecundario onClick={() => void copiarErrores()}>{copiado ? '✔ Copiado' : 'Copiar errores para la IA'}</BotonSecundario>
            )
          }
        >
          {error ? (
            <Mensaje>{error}</Mensaje>
          ) : (
            <div className="max-h-[28rem] overflow-auto">
              <table className="w-full text-left text-sm">
                <thead className="sticky top-0 bg-white text-xs uppercase tracking-wide text-profundo/50">
                  <tr>
                    <th className="py-1 pr-2">Fila</th>
                    <th className="py-1 pr-2">Tipo</th>
                    <th className="py-1 pr-2">Ítem</th>
                    <th className="py-1 pr-2">Etiquetas</th>
                    <th className="py-1">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {filas.map((f) => {
                    const err = errorDe(f)
                    return (
                      <tr key={f.fila} className={`border-t border-profundo/10 ${err ? 'bg-naranja/10' : ''}`}>
                        <td className="py-1.5 pr-2 text-profundo/60">{f.fila}</td>
                        <td className="py-1.5 pr-2 text-profundo/60">{f.item ? (NOMBRE_TIPO[f.item.tipo as TipoItem] ?? f.item.tipo) : '—'}</td>
                        <td className="max-w-sm truncate py-1.5 pr-2">{f.item ? resumenItem(f.item.tipo, f.item.contenido, f.item.solucion) : ''}</td>
                        <td className="py-1.5 pr-2 text-profundo/60">{f.item?.etiquetas.join(', ')}</td>
                        <td className={`py-1.5 font-semibold ${err ? 'text-naranja' : 'text-green-700'}`}>{err ?? '✔'}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Tarjeta>
      )}

      {filas.length > 0 && !error && (
        <Tarjeta titulo="3. Importar">
          <div className="grid gap-3 md:grid-cols-2">
            <Etiqueta texto="Quedan como">
              <select value={estado} onChange={(e) => setEstado(e.target.value as 'aprobado' | 'sugerido')} className={CAMPO}>
                <option value="aprobado">Aprobados (listos para usar)</option>
                <option value="sugerido">Sugeridos (para revisar antes)</option>
              </select>
            </Etiqueta>
            <Etiqueta texto="Agregarlos a un bloque" ayuda="(opcional)">
              <select value={bloqueId} onChange={(e) => setBloqueId(e.target.value)} className={CAMPO}>
                <option value="">No, solo al catálogo</option>
                {bloques.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.event?.name ?? '?'} · {b.position}. {b.title} ({metaDe(b.dynamic).nombre})
                  </option>
                ))}
              </select>
            </Etiqueta>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <BotonPrincipal disabled={enviando || conError > 0} onClick={() => void importar()}>
              {enviando ? 'Importando…' : `Importar ${validas} ítems`}
            </BotonPrincipal>
            {conError > 0 && <p className="text-sm font-semibold text-naranja">Corregí las filas con errores para poder importar.</p>}
          </div>
        </Tarjeta>
      )}

      {resultado && (
        <Mensaje tipo={resultado.ok ? 'ok' : 'error'}>
          {resultado.texto}{' '}
          {resultado.ok && (
            <Link to="/admin/catalogo" className="underline">
              Ver el catálogo
            </Link>
          )}
        </Mensaje>
      )}
    </div>
  )
}
