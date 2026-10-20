import { useState, type FormEvent } from 'react'
import { Logo } from '../components/Logo'
import { formatearFecha } from '../lib/fechas'
import { ErrorRpc, joinTeam } from '../lib/rpc'
import type { EventoPublico, MiMesa } from '../lib/tipos'
import { Aviso } from './Aviso'

type Props = { evento: EventoPublico; onEntrar: (m: MiMesa) => void; onReingreso: () => void }

export function Registro({ evento, onEntrar, onReingreso }: Props) {
  const [nombre, setNombre] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function enviar(e: FormEvent) {
    e.preventDefault()
    const limpio = nombre.trim().replace(/\s+/g, ' ')
    if (limpio.length < 2) {
      setError('Escribí un nombre de al menos 2 letras.')
      return
    }
    setEnviando(true)
    setError(null)
    try {
      onEntrar(await joinTeam(evento.code, limpio))
    } catch (err) {
      setError(err instanceof ErrorRpc ? err.message : 'Algo salió mal. Probá de nuevo.')
      setEnviando(false)
    }
  }

  return (
    <div className="flex flex-1 flex-col items-center gap-6 text-center">
      <Logo className="w-40 shadow-md" />
      <div>
        <h1 className="text-2xl font-bold leading-tight">{evento.name}</h1>
        <p className="mt-1 text-profundo/70">{[formatearFecha(evento.date), evento.venue].filter(Boolean).join(' · ')}</p>
      </div>

      <form onSubmit={enviar} className="flex w-full flex-col gap-4">
        <label className="text-left">
          <span className="mb-2 block font-bold">¿Cómo se llama tu mesa?</span>
          <input
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            maxLength={24}
            autoComplete="off"
            autoCapitalize="words"
            enterKeyHint="go"
            placeholder="Ej.: Los Dados Locos"
            className="min-h-toque w-full rounded-carta border-2 border-profundo/15 bg-white px-4 text-lg focus:border-azul focus:outline-none"
          />
        </label>
        {error && <Aviso>{error}</Aviso>}
        <button type="submit" disabled={enviando} className="boton-principal w-full">
          {enviando ? 'Entrando…' : 'Entrar a jugar'}
        </button>
      </form>

      <button onClick={onReingreso} className="min-h-toque font-semibold text-azul underline underline-offset-4">
        Ya estamos jugando
      </button>
    </div>
  )
}
