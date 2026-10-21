import type { Temporizador } from '../live/useTemporizador'

/** Anillo que se vacía. En 0 muestra "¡Tiempo!" y las respuestas se cierran solas (useCierreAutomatico). */
export function TemporizadorCircular({ temporizador }: { temporizador: Temporizador }) {
  if (!temporizador) return null
  const { restantes, total } = temporizador
  const segundos = Math.max(0, Math.ceil(restantes))
  const fraccion = total > 0 ? Math.min(1, Math.max(0, restantes / total)) : 0
  const urgente = segundos <= 5
  const R = 44
  const C = 2 * Math.PI * R

  return (
    <div className="relative aspect-square w-full" role="timer" aria-label={`Quedan ${segundos} segundos`}>
      <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
        <circle cx="50" cy="50" r={R} fill="none" stroke="rgb(255 255 255 / 0.15)" strokeWidth="8" />
        <circle
          cx="50"
          cy="50"
          r={R}
          fill="none"
          stroke={urgente ? 'rgb(var(--fl-naranja))' : 'rgb(var(--fl-celeste))'}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={C}
          strokeDashoffset={C * (1 - fraccion)}
          className="transition-[stroke-dashoffset] duration-300 ease-linear"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        {segundos > 0 ? (
          <span className="font-titulo text-[5cqw] font-bold tabular-nums">{segundos}</span>
        ) : (
          <span className="font-titulo text-[2.6cqw] font-bold text-naranja">¡Tiempo!</span>
        )}
      </div>
    </div>
  )
}
