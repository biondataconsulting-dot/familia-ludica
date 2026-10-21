import { ENTRADA_ANIO } from './entrada'
import { TecladoNumerico } from './TecladoNumerico'

const ANIO_INICIAL = 1990

type Props = { texto: string; onTexto: (t: string) => void }

/** Año con − / + (de a 1 y de a 10) y teclado para escribirlo directo. También lo usa Hitster. */
export function SelectorAnio({ texto, onTexto }: Props) {
  const sumar = (n: number) => {
    const actual = texto ? Number(texto) : ANIO_INICIAL - n
    onTexto(String(Math.min(9999, Math.max(1, actual + n))))
  }

  return (
    <div className="flex w-full flex-col gap-3">
      <div className="grid grid-cols-4 gap-2">
        {[-10, -1, 1, 10].map((n) => (
          <button
            key={n}
            onClick={() => sumar(n)}
            className="min-h-toque rounded-carta bg-azul font-titulo text-xl font-semibold text-white active:scale-95"
          >
            {n > 0 ? `+${n}` : `−${-n}`}
          </button>
        ))}
      </div>
      <TecladoNumerico texto={texto} onTexto={onTexto} opciones={ENTRADA_ANIO} placeholder="Año" />
    </div>
  )
}
