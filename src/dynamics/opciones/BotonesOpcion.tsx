import { COLORES_OPCION } from '../colores'

type Props = {
  /** Etiqueta grande de cada botón: "A", "B"… o "1", "2"… */
  etiquetas: string[]
  textos: string[]
  elegida: number | null
  onElegir: (i: number) => void
  colores?: boolean
}

/** Botones grandes para elegir una opción en el celular (≥ 48 px, uno por fila). */
export function BotonesOpcion({ etiquetas, textos, elegida, onElegir, colores = true }: Props) {
  return (
    <div className="flex w-full flex-col gap-3" role="radiogroup">
      {textos.map((texto, i) => {
        const activa = elegida === i
        const color = colores ? COLORES_OPCION[i % COLORES_OPCION.length] : 'bg-white text-profundo border-2 border-profundo/15'
        return (
          <button
            key={i}
            role="radio"
            aria-checked={activa}
            aria-label={`${etiquetas[i]}: ${texto}`}
            onClick={() => onElegir(i)}
            className={`flex min-h-[64px] items-center gap-4 rounded-carta px-4 py-3 text-left text-lg font-bold shadow-sm transition ${color} ${
              activa ? 'scale-[1.02] ring-4 ring-profundo ring-offset-2 ring-offset-crema' : elegida != null ? 'opacity-50' : ''
            }`}
          >
            <span className="font-titulo text-3xl leading-none">{etiquetas[i]}</span>
            <span className="line-clamp-2 flex-1">{texto}</span>
            {activa && <span aria-hidden>✔</span>}
          </button>
        )
      })}
    </div>
  )
}
