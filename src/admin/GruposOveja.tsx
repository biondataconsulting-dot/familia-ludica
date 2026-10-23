import { useState } from 'react'
import { conMayuscula } from '../dynamics/oveja/validate'
import { ErrorRpc } from '../lib/rpc'
import { admin } from '../lib/rpcAdmin'
import type { Live } from '../lib/tipos'
import type { RespuestaAdmin } from './useRespuestasAdmin'

type Props = {
  respuestas: RespuestaAdmin[]
  mesas: Live['teams']
  blockItemId: string
  /** Con las respuestas cerradas y antes de revelar. */
  editable: boolean
  onCambio: () => void
}

type Grupo = { clave: string; etiqueta: string; miembros: { id: string; mesa: string; texto: string }[] }

/**
 * Oveja Oveja: las respuestas agrupadas como las va a contar la base. Con las respuestas cerradas, el
 * conductor junta grupos que dicen lo mismo ("auto" con "coche") o deja sola una respuesta mal agrupada.
 */
export function GruposOveja({ respuestas, mesas, blockItemId, editable, onCambio }: Props) {
  const [ocupado, setOcupado] = useState(false)
  const [falla, setFalla] = useState<string | null>(null)
  const nombre = new Map(mesas.map((m) => [m.id, m.name]))

  const porClave = new Map<string, Grupo>()
  for (const r of respuestas) {
    const texto = String(r.answer.texto ?? '')
    // Antes de cerrar todavía no hay grupos: se muestra cada texto tal cual.
    const clave = r.validation?.grupo || texto.trim().toLowerCase()
    const g = porClave.get(clave) ?? { clave, etiqueta: '', miembros: [] }
    g.miembros.push({ id: r.id, mesa: nombre.get(r.team_id) ?? 'Mesa', texto })
    porClave.set(clave, g)
  }
  const grupos = [...porClave.values()]
    .map((g) => {
      const veces = new Map<string, number>()
      for (const m of g.miembros) veces.set(m.texto, (veces.get(m.texto) ?? 0) + 1)
      const [etiqueta] = [...veces.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0] ?? ['']
      return { ...g, etiqueta: conMayuscula(etiqueta) }
    })
    .sort((a, b) => b.miembros.length - a.miembros.length || a.etiqueta.localeCompare(b.etiqueta))
  const max = grupos[0]?.miembros.length ?? 0
  const empateArriba = grupos.filter((g) => g.miembros.length === max).length > 1
  const todas = grupos.length === 1

  async function ejecutar(accion: () => Promise<unknown>) {
    setOcupado(true)
    setFalla(null)
    try {
      await accion()
      onCambio()
    } catch (e) {
      setFalla(e instanceof ErrorRpc ? e.message : 'No se pudo.')
    } finally {
      setOcupado(false)
    }
  }

  return (
    <div className="mb-3 rounded-xl bg-crema p-3">
      <p className="text-sm font-bold">
        🐑 Grupos{' '}
        <span className="font-semibold text-profundo/70">
          {todas ? '· todas iguales: nadie suma' : empateArriba ? '· las más elegidas empatan: nadie suma' : `· suma el grupo de ${max}`}
        </span>
      </p>
      <p className="mb-2 text-xs text-profundo/70">
        {editable
          ? 'Si dos grupos dicen lo mismo, juntalos. Si una respuesta quedó mal agrupada, separala.'
          : 'Se pueden juntar o separar con las respuestas cerradas, antes de revelar.'}
      </p>
      {falla && <p className="mb-2 text-sm font-semibold text-naranja">{falla}</p>}
      <ul className="flex flex-col gap-2">
        {grupos.map((g) => (
          <li key={g.clave} className="rounded-lg bg-white p-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`font-bold ${!todas && !empateArriba && g.miembros.length === max ? 'text-naranja' : ''}`}>{g.etiqueta}</span>
              <span className="text-xs font-bold text-profundo/60">
                {g.miembros.length} {g.miembros.length === 1 ? 'mesa' : 'mesas'}
              </span>
              {editable && grupos.length > 1 && (
                <select
                  aria-label={`Juntar «${g.etiqueta}» con otro grupo`}
                  disabled={ocupado}
                  value=""
                  onChange={(e) => e.target.value && void ejecutar(() => admin.ovejaJuntar(blockItemId, g.clave, e.target.value))}
                  className="ml-auto rounded-lg border-2 border-profundo/15 px-2 py-1 text-xs"
                >
                  <option value="">Juntar con…</option>
                  {grupos
                    .filter((o) => o.clave !== g.clave)
                    .map((o) => (
                      <option key={o.clave} value={o.clave}>
                        {o.etiqueta}
                      </option>
                    ))}
                </select>
              )}
            </div>
            <div className="mt-1 flex flex-wrap gap-1">
              {g.miembros.map((m) => (
                <span key={m.id} className="flex items-center gap-1 rounded-full bg-crema px-2 py-0.5 text-xs">
                  <b>{m.mesa}:</b> {m.texto}
                  {editable && g.miembros.length > 1 && (
                    <button
                      disabled={ocupado}
                      onClick={() => void ejecutar(() => admin.ovejaSeparar(m.id))}
                      className="font-bold text-profundo/60 underline disabled:opacity-40"
                      title="Dejar sola esta respuesta"
                    >
                      separar
                    </button>
                  )}
                </span>
              ))}
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
