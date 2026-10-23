import { useMemo } from 'react'

const COLORES = ['#EC681B', '#3FC0F0', '#FFF8F2', '#F4D35E', '#FFFFFF']

/** Papelitos que caen una vez (con movimiento reducido no se ven). Cambiar `key` los vuelve a tirar. */
export function Confeti({ cantidad = 90 }: { cantidad?: number }) {
  const piezas = useMemo(
    () =>
      Array.from({ length: cantidad }, (_, i) => ({
        izquierda: Math.random() * 100,
        demora: Math.random() * 1.6,
        duracion: 2.6 + Math.random() * 2,
        ancho: 0.6 + Math.random() * 0.7,
        color: COLORES[i % COLORES.length],
        giro: Math.random() * 360,
      })),
    [cantidad],
  )
  return (
    <div className="pointer-events-none absolute inset-0 z-30 overflow-hidden motion-reduce:hidden" aria-hidden>
      {piezas.map((p, i) => (
        <span
          key={i}
          className="absolute -top-[3cqw] block animate-confeti rounded-[0.15cqw]"
          style={{
            left: `${p.izquierda}%`,
            width: `${p.ancho}cqw`,
            height: `${p.ancho * 1.6}cqw`,
            background: p.color,
            rotate: `${p.giro}deg`,
            animationDelay: `${p.demora}s`,
            animationDuration: `${p.duracion}s`,
          }}
        />
      ))}
    </div>
  )
}
