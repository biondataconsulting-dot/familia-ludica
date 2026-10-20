import { formatearNumero } from '../dynamics/solucion'

type Props = {
  puesto: number
  nombre: string
  total: number
  /** Texto chico a la derecha del nombre (ej.: "+1.000 en el bloque"). */
  extra?: string
  /** Puestos que subió (+) o bajó (−) desde el ítem anterior. */
  movimiento?: number
  /** Tamaño base de la letra en cqw. */
  tam?: number
}

/** Una fila del ranking sobre tarjeta clara. El primer puesto va con fondo amarillo (nunca texto amarillo). */
export function FilaPuesto({ puesto, nombre, total, extra, movimiento, tam = 1.6 }: Props) {
  const primero = puesto === 1
  return (
    <div
      className={`flex items-center gap-[0.8em] rounded-[0.6em] px-[0.7em] py-[0.35em] font-bold text-profundo ${primero ? 'bg-amarillo' : 'bg-white'}`}
      style={{ fontSize: `${tam}cqw` }}
    >
      <span className="w-[1.6em] shrink-0 text-center font-titulo">{puesto}</span>
      <span className="min-w-0 flex-1 truncate">{nombre}</span>
      {extra && <span className="shrink-0 text-[0.75em] font-semibold text-profundo/60">{extra}</span>}
      <span className="shrink-0 font-titulo tabular-nums">{formatearNumero(total)}</span>
      {movimiento !== undefined && <Flecha movimiento={movimiento} />}
    </div>
  )
}

function Flecha({ movimiento }: { movimiento: number }) {
  if (movimiento > 0)
    return (
      <span className="w-[2.2em] shrink-0 text-right text-[0.8em] text-green-700" aria-label={`subió ${movimiento}`}>
        ▲{movimiento}
      </span>
    )
  if (movimiento < 0)
    return (
      <span className="w-[2.2em] shrink-0 text-right text-[0.8em] text-naranja" aria-label={`bajó ${-movimiento}`}>
        ▼{-movimiento}
      </span>
    )
  return (
    <span className="w-[2.2em] shrink-0 text-right text-[0.8em] text-profundo/45" aria-label="sin cambios">
      –
    </span>
  )
}
