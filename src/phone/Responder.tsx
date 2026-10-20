import { useState } from 'react'
import type { Dinamica, Respuesta } from '../dynamics/tipos'
import { ErrorRpc, submitAnswer } from '../lib/rpc'
import type { Live, MiMesa } from '../lib/tipos'
import { Aviso } from './Aviso'

type Props = {
  live: Live
  mesa: MiMesa
  dinamica: Dinamica
  /** Lo que ya enviaron a este ítem (null si todavía no). */
  enviada: Respuesta | null
  onEnviada: (r: Respuesta) => void
}

/**
 * Fase item_open: el formulario de la dinámica y "Enviar respuesta"; después, "¡Respuesta enviada!"
 * con lo que mandaron y la opción de cambiarla mientras siga abierto. Se monta con key = ítem.
 */
export function Responder({ live, mesa, dinamica, enviada, onEnviada }: Props) {
  const item = live.item!
  const [borrador, setBorrador] = useState<Respuesta | null>(null)
  const [editando, setEditando] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (enviada && !editando) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
        <p className="text-6xl" aria-hidden>
          ✅
        </p>
        <h1 className="text-3xl font-bold">¡Respuesta enviada!</h1>
        {Object.keys(enviada).length > 0 && (
          <p className="rounded-carta bg-white px-5 py-3 text-lg font-bold shadow-sm">{dinamica.describir(item.content, enviada)}</p>
        )}
        <p className="text-profundo/70">
          Respondieron {live.answers_count} de {live.teams_count}
        </p>
        <button
          onClick={() => {
            setBorrador(Object.keys(enviada).length > 0 ? enviada : null)
            setEditando(true)
          }}
          className="min-h-toque rounded-carta border-2 border-profundo/15 px-5 font-semibold"
        >
          Cambiar mi respuesta
        </button>
      </div>
    )
  }

  const problema = dinamica.validar(item, borrador)

  async function enviar() {
    if (problema || !borrador) {
      setError(problema)
      return
    }
    setEnviando(true)
    setError(null)
    try {
      const { answer } = await submitAnswer(mesa.token, item.block_item_id, borrador)
      onEnviada(answer)
      setEditando(false)
    } catch (e) {
      setError(e instanceof ErrorRpc ? e.message : 'Algo salió mal. Probá de nuevo.')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="flex flex-1 flex-col gap-4">
      <h1 className="text-center text-2xl font-bold">{dinamica.instruccion?.(item) ?? dinamica.meta.instruccionCelular}</h1>
      <dinamica.PhoneInput item={item} valor={borrador} onCambiar={setBorrador} />
      {error && <Aviso>{error}</Aviso>}
      <div className="sticky bottom-0 -mx-4 mt-auto bg-crema/95 px-4 pb-4 pt-2">
        <button onClick={() => void enviar()} disabled={enviando || problema != null} className="boton-principal w-full text-xl">
          {enviando ? 'Enviando…' : 'Enviar respuesta'}
        </button>
        {editando && (
          <button onClick={() => setEditando(false)} className="mt-2 min-h-toque w-full font-semibold text-profundo/70">
            Dejar la que mandé
          </button>
        )}
      </div>
    </div>
  )
}
