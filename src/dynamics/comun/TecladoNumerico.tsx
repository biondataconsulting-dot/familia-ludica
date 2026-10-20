import { agregarTecla, formatearEntrada, type OpcionesEntrada } from './entrada'

type Props = {
  texto: string
  onTexto: (t: string) => void
  opciones: OpcionesEntrada
  /** Texto chico al lado del número (ej.: "metros"). */
  unidad?: string
  placeholder?: string
}

/** Visor grande + teclado propio (más grande y predecible que el del sistema). */
export function TecladoNumerico({ texto, onTexto, opciones, unidad, placeholder = 'Tu número' }: Props) {
  const teclas = ['1', '2', '3', '4', '5', '6', '7', '8', '9', opciones.decimales ? ',' : '', '0', '⌫']
  const tocar = (t: string) => onTexto(agregarTecla(texto, t, opciones))

  return (
    <div className="flex w-full flex-col items-center gap-3">
      <div className="flex w-full items-center gap-2 rounded-carta border-2 border-azul bg-white px-4 py-3" aria-live="polite">
        {opciones.negativos && (
          <button
            onClick={() => tocar('±')}
            aria-label="Cambiar signo"
            className="min-h-toque min-w-[48px] rounded-xl bg-crema font-titulo text-xl font-bold"
          >
            ±
          </button>
        )}
        <p className={`flex-1 text-right font-titulo text-4xl font-bold tabular-nums ${texto ? '' : 'text-profundo/30'}`}>
          {texto ? formatearEntrada(texto, opciones.agruparMiles) : placeholder}
        </p>
        {unidad && <span className="text-lg font-semibold text-profundo/60">{unidad}</span>}
      </div>
      <div className="grid w-full grid-cols-3 gap-2">
        {teclas.map((t, i) =>
          t ? (
            <button
              key={i}
              onClick={() => tocar(t)}
              aria-label={t === '⌫' ? 'Borrar' : t === ',' ? 'Coma decimal' : t}
              className="min-h-[56px] rounded-carta bg-white font-titulo text-2xl font-semibold shadow-sm active:scale-95"
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
