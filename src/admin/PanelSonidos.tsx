import { useEffect, useState } from 'react'
import { ErrorRpc } from '../lib/rpc'
import { admin } from '../lib/rpcAdmin'
import { supabase } from '../lib/supabase'
import type { Live } from '../lib/tipos'

type Sonido = { id: string; titulo: string; repetir: boolean }

const LUGARES = 3

/**
 * Conducir: 3 botones de música o sonidos del catálogo (tipo "Música o sonido"). Cada uno se elige de una
 * lista y se prende o apaga con un toque; suena uno por vez, en el proyector. Abrir una canción o escena del
 * juego lo apaga solo.
 */
export function PanelSonidos({ eventId, live }: { eventId: string; live: Live }) {
  const [catalogo, setCatalogo] = useState<Sonido[] | null>(null)
  const [elegidos, setElegidos] = useState<string[]>(() => live.event.settings.sonidos ?? [])
  const [ocupado, setOcupado] = useState(false)
  const [falla, setFalla] = useState<string | null>(null)
  const sonando = live.sonido?.id ?? null

  useEffect(() => {
    void supabase
      .from('catalog_items')
      .select('id, content')
      .eq('type', 'sonido')
      .order('created_at')
      .then(({ data }) =>
        setCatalogo(
          (data ?? []).map((d) => {
            const c = (d.content ?? {}) as Record<string, unknown>
            return { id: d.id as string, titulo: String(c.titulo ?? 'Sonido'), repetir: c.repetir === true }
          }),
        ),
      )
  }, [])

  const ejecutar = async (accion: () => Promise<unknown>) => {
    setOcupado(true)
    setFalla(null)
    try {
      await accion()
    } catch (e) {
      setFalla(e instanceof ErrorRpc ? e.message : 'No se pudo.')
    } finally {
      setOcupado(false)
    }
  }

  const elegir = (lugar: number, id: string) => {
    const nuevos = Array.from({ length: LUGARES }, (_, i) => (i === lugar ? id : (elegidos[i] ?? '')))
    setElegidos(nuevos)
    void ejecutar(() => admin.setSonidos(eventId, nuevos.filter(Boolean)))
  }

  if (catalogo && catalogo.length === 0) {
    return (
      <p className="text-sm text-profundo/60">
        🎵 Para tener música o sonidos a mano, cargalos en el catálogo como «Música o sonido».
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-bold">🎵 Música y sonidos</span>
        {Array.from({ length: LUGARES }, (_, i) => {
          // Un sonido que se borró del catálogo deja el lugar vacío.
          const elegido = elegidos[i] ?? ''
          const id = catalogo && !catalogo.some((x) => x.id === elegido) ? '' : elegido
          const activo = Boolean(id) && sonando === id
          return (
            <div key={i} className={`flex items-center gap-1 rounded-xl border-2 p-1 ${activo ? 'border-naranja bg-naranja/10' : 'border-profundo/15'}`}>
              <select
                value={id}
                disabled={ocupado || !catalogo}
                onChange={(e) => elegir(i, e.target.value)}
                aria-label={`Sonido ${i + 1}`}
                className="max-w-[11rem] rounded-lg bg-transparent px-1 py-1 text-sm"
              >
                <option value="">— elegir —</option>
                {(catalogo ?? []).map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.titulo}
                    {s.repetir ? ' 🔁' : ''}
                  </option>
                ))}
              </select>
              <button
                disabled={ocupado || !id}
                onClick={() => void ejecutar(() => admin.sonido(eventId, activo ? null : id))}
                aria-label={activo ? 'Apagar' : 'Prender'}
                className={`min-h-[40px] min-w-[40px] rounded-lg font-bold text-white disabled:opacity-30 ${activo ? 'bg-profundo' : 'bg-naranja'}`}
              >
                {activo ? '■' : '▶'}
              </button>
            </div>
          )
        })}
      </div>
      {falla && <p className="text-sm font-semibold text-naranja">{falla}</p>}
    </div>
  )
}
