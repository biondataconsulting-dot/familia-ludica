import { useState } from 'react'
import { ErrorRpc, rejoinTeam } from '../lib/rpc'
import type { MesaPublica, MiMesa } from '../lib/tipos'
import { Aviso } from './Aviso'

type Props = { codigo: string; mesas: MesaPublica[]; onEntrar: (m: MiMesa) => void; onVolver: () => void }

/** "Ya estamos jugando": elegir la mesa y poner su PIN para seguir desde este celular. */
export function Reingreso({ codigo, mesas, onEntrar, onVolver }: Props) {
  const [elegida, setElegida] = useState<MesaPublica | null>(null)

  return (
    <div className="flex flex-1 flex-col gap-5">
      <button onClick={elegida ? () => setElegida(null) : onVolver} className="min-h-toque self-start font-semibold text-azul">
        ← Volver
      </button>
      {elegida ? (
        <TecladoPin codigo={codigo} mesa={elegida} onEntrar={onEntrar} />
      ) : (
        <>
          <h1 className="text-2xl font-bold">¿Cuál es tu mesa?</h1>
          {mesas.length === 0 ? (
            <p className="text-profundo/70">Todavía no hay mesas registradas. Volvé y registren la suya.</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {mesas.map((m) => (
                <li key={m.id}>
                  <button
                    onClick={() => setElegida(m)}
                    className="min-h-toque w-full rounded-carta border-2 border-profundo/15 bg-white px-4 py-3 text-left text-lg font-bold hover:border-azul"
                  >
                    {m.name}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  )
}

const TECLAS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫'] as const

function TecladoPin({ codigo, mesa, onEntrar }: { codigo: string; mesa: MesaPublica; onEntrar: (m: MiMesa) => void }) {
  const [pin, setPin] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function probar(completo: string) {
    setEnviando(true)
    setError(null)
    try {
      onEntrar(await rejoinTeam(codigo, mesa.id, completo))
    } catch (e) {
      setError(e instanceof ErrorRpc ? e.message : 'Algo salió mal. Probá de nuevo.')
      setPin('')
      setEnviando(false)
    }
  }

  function tocar(tecla: (typeof TECLAS)[number]) {
    if (enviando || !tecla) return
    if (tecla === '⌫') return setPin((p) => p.slice(0, -1))
    if (pin.length >= 4) return
    const nuevo = pin + tecla
    setPin(nuevo)
    if (nuevo.length === 4) void probar(nuevo)
  }

  return (
    <div className="flex flex-col items-center gap-5 text-center">
      <div>
        <p className="text-profundo/70">PIN de la mesa</p>
        <h1 className="text-2xl font-bold">{mesa.name}</h1>
      </div>
      <div className="flex gap-3" aria-label={`PIN: ${pin.length} de 4 dígitos`}>
        {[0, 1, 2, 3].map((i) => (
          <span
            key={i}
            className={`flex h-14 w-12 items-center justify-center rounded-xl border-2 font-titulo text-3xl font-bold ${
              i < pin.length ? 'border-azul bg-white' : 'border-profundo/15 bg-white/60'
            }`}
          >
            {pin[i] ?? ''}
          </span>
        ))}
      </div>
      {error && <Aviso>{error}</Aviso>}
      <p className="text-sm text-profundo/75">Lo ven arriba, en el otro celular de la mesa.</p>
      <div className="grid w-full max-w-xs grid-cols-3 gap-3">
        {TECLAS.map((t, i) =>
          t ? (
            <button
              key={i}
              onClick={() => tocar(t)}
              disabled={enviando}
              aria-label={t === '⌫' ? 'Borrar' : t}
              className="min-h-[56px] rounded-carta bg-white font-titulo text-2xl font-semibold shadow-sm active:scale-95 disabled:opacity-50"
            >
              {t}
            </button>
          ) : (
            <span key={i} />
          ),
        )}
      </div>
    </div>
  )
}
