import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { resumenItem, useCatalogo } from '../../admin/useCatalogo'
import { BotonPrincipal, BotonSecundario, CAMPO, Mensaje, Tarjeta } from '../../admin/ui'
import { NOMBRE_TIPO, TIPOS } from '../../content/validarItem'
import { ErrorRpc } from '../../lib/rpc'
import { admin } from '../../lib/rpcAdmin'

const ESTADOS = { aprobado: 'Aprobado', sugerido: 'Sugerido', borrador: 'Borrador' } as const

/** /admin/catalogo — todo el contenido, con filtros por tipo, etiqueta, estado y texto. */
export default function AdminCatalogo() {
  const { items, error, recargar } = useCatalogo()
  const [tipo, setTipo] = useState('')
  const [etiqueta, setEtiqueta] = useState('')
  const [estado, setEstado] = useState('')
  const [texto, setTexto] = useState('')
  const [aviso, setAviso] = useState<string | null>(null)
  const etiquetas = useMemo(() => [...new Set((items ?? []).flatMap((i) => i.tags))].sort(), [items])

  const t = texto.trim().toLowerCase()
  const visibles = (items ?? []).filter(
    (i) =>
      (!tipo || i.type === tipo) &&
      (!etiqueta || i.tags.includes(etiqueta)) &&
      (!estado || i.status === estado) &&
      (!t || `${resumenItem(i.type, i.content, i.solution)} ${JSON.stringify(i.content)}`.toLowerCase().includes(t)),
  )

  async function borrar(id: string, nombre: string) {
    if (!window.confirm(`¿Borrar «${nombre}» del catálogo?`)) return
    setAviso(null)
    try {
      await admin.deleteItem(id)
      void recargar()
    } catch (e) {
      setAviso(e instanceof ErrorRpc ? e.message : 'No se pudo borrar.')
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-3xl font-bold">Catálogo</h1>
        <div className="ml-auto flex flex-wrap gap-2">
          {TIPOS.map((t) => (
            <Link key={t} to={`/admin/catalogo/nuevo?tipo=${t}`}>
              <BotonSecundario>+ {NOMBRE_TIPO[t]}</BotonSecundario>
            </Link>
          ))}
          <Link to="/admin/importar">
            <BotonPrincipal>Importar</BotonPrincipal>
          </Link>
        </div>
      </div>

      <Tarjeta>
        <div className="mb-3 grid gap-2 md:grid-cols-4">
          <select value={tipo} onChange={(e) => setTipo(e.target.value)} className={CAMPO} aria-label="Tipo">
            <option value="">Todos los tipos</option>
            {TIPOS.map((t) => (
              <option key={t} value={t}>
                {NOMBRE_TIPO[t]}
              </option>
            ))}
          </select>
          <select value={etiqueta} onChange={(e) => setEtiqueta(e.target.value)} className={CAMPO} aria-label="Etiqueta">
            <option value="">Todas las etiquetas</option>
            {etiquetas.map((e) => (
              <option key={e}>{e}</option>
            ))}
          </select>
          <select value={estado} onChange={(e) => setEstado(e.target.value)} className={CAMPO} aria-label="Estado">
            <option value="">Todos los estados</option>
            {Object.entries(ESTADOS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
          <input value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Buscar…" className={CAMPO} />
        </div>

        {error && <Mensaje>{error}</Mensaje>}
        {aviso && <Mensaje>{aviso}</Mensaje>}
        {!items ? (
          <p className="text-profundo/70">Cargando…</p>
        ) : (
          <>
            <p className="mb-2 text-sm text-profundo/60">
              {visibles.length} de {items.length} ítems
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="text-xs uppercase tracking-wide text-profundo/50">
                  <tr>
                    <th className="py-1 pr-2">Tipo</th>
                    <th className="py-1 pr-2">Ítem</th>
                    <th className="py-1 pr-2">Etiquetas</th>
                    <th className="py-1 pr-2">Estado</th>
                    <th className="py-1 pr-2">Noches</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {visibles.map((i) => {
                    const resumen = resumenItem(i.type, i.content, i.solution)
                    return (
                      <tr key={i.id} className="border-t border-profundo/10">
                        <td className="whitespace-nowrap py-2 pr-2 text-profundo/60">{NOMBRE_TIPO[i.type] ?? i.type}</td>
                        <td className="max-w-md py-2 pr-2">
                          <Link to={`/admin/catalogo/${i.id}`} className="font-semibold hover:underline">
                            {resumen || '(sin texto)'}
                          </Link>
                        </td>
                        <td className="py-2 pr-2 text-profundo/60">{i.tags.join(', ')}</td>
                        <td className={`py-2 pr-2 font-semibold ${i.status === 'aprobado' ? '' : 'text-naranja'}`}>{ESTADOS[i.status]}</td>
                        <td className="py-2 pr-2 text-profundo/60">{i.used_in_events.length || ''}</td>
                        <td className="whitespace-nowrap py-2 text-right">
                          <Link to={`/admin/catalogo/${i.id}`} className="mr-2 font-semibold text-azul">
                            Editar
                          </Link>
                          <button onClick={() => void borrar(i.id, resumen)} className="font-semibold text-naranja">
                            Borrar
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </Tarjeta>
    </div>
  )
}
