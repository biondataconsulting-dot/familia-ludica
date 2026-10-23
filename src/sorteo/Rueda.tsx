import { useMemo } from 'react'
import type { Persona } from './rpc'

/** Colores de las porciones (alternados) y del texto sobre cada una. */
const PORCIONES = [
  { fondo: '#EC681B', texto: '#FFFFFF' },
  { fondo: '#FFF8F2', texto: '#173F63' },
]
/** Si la cantidad es impar, la última va en celeste (para no juntar dos del mismo color). */
const PORCION_IMPAR = { fondo: '#3FC0F0', texto: '#173F63' }

/** Radios (en unidades del dibujo, de -100 a 100): borde, porciones y desde dónde arranca el nombre. */
const R_BORDE = 96
const R_PORCION = 84
const R_TEXTO_DESDE = 20
const R_TEXTO_HASTA = 78

/**
 * Rueda de la fortuna de circo (pocos participantes): una porción por persona, el nombre a lo largo del
 * radio y la flecha arriba. `posicion` en porciones: la que está bajo la flecha es `round(posicion)`.
 * Gira en el sentido de las agujas del reloj; la flecha rebota con cada clavito del borde.
 */
export function Rueda({ rueda, posicion, tachado }: { rueda: Persona[]; posicion: number; tachado: boolean }) {
  const n = rueda.length
  const paso = 360 / Math.max(n, 1)
  const porciones = useMemo(() => dibujarPorciones(rueda), [rueda])
  const enFlecha = ((Math.round(posicion) % n) + n) % n

  // La lengüeta: la empuja un clavito (en el borde entre porciones) y vuelve.
  const desdeClavito = posicion + 0.5 - Math.floor(posicion + 0.5)
  const lengueta = desdeClavito < 0.3 ? 22 * (1 - desdeClavito / 0.3) : 0

  return (
    <svg viewBox="-100 -104 200 236" className="mx-auto h-[46cqw] w-auto drop-shadow-2xl" aria-hidden>
      <defs>
        <radialGradient id="rueda-centro" cx="40%" cy="35%">
          <stop offset="0%" stopColor="#FFF6C9" />
          <stop offset="60%" stopColor="#F4D35E" />
          <stop offset="100%" stopColor="#B8862B" />
        </radialGradient>
      </defs>
      {/* Pie */}
      <path d="M -22 88 L 22 88 L 34 120 L -34 120 Z" fill="#173F63" />
      <rect x="-48" y="118" width="96" height="10" rx="3" fill="#0f2c47" />
      {/* Borde con lamparitas */}
      <circle r={R_BORDE} fill="#173F63" stroke="#B8862B" strokeWidth="2.5" />
      {Array.from({ length: 24 }, (_, i) => {
        const a = (i / 24) * 2 * Math.PI
        return <circle key={i} cx={Math.sin(a) * 90} cy={-Math.cos(a) * 90} r="2.1" fill="#F4D35E" />
      })}
      {/* Porciones (lo que gira) */}
      <g transform={`rotate(${posicion * paso})`}>
        {porciones.map((p, i) => (
          <g key={rueda[i]!.id} transform={`rotate(${-i * paso})`} opacity={tachado && i === enFlecha ? 0.45 : 1}>
            <path d={p.forma} fill={p.color.fondo} stroke="#B8862B" strokeWidth="0.6" />
            <text
              transform="rotate(-90)"
              x={R_TEXTO_HASTA}
              y="0"
              textAnchor="end"
              dominantBaseline="central"
              fill={p.color.texto}
              fontSize={p.letra}
              fontFamily="Fredoka, sans-serif"
              fontWeight="700"
              textDecoration={tachado && i === enFlecha ? 'line-through' : undefined}
            >
              {p.nombre}
            </text>
            {/* Clavito en el borde de la porción */}
            <circle cx={Math.sin((paso / 2) * (Math.PI / 180)) * 81} cy={-Math.cos((paso / 2) * (Math.PI / 180)) * 81} r="1.4" fill="#B8862B" />
          </g>
        ))}
      </g>
      {/* Centro dorado */}
      <circle r="12" fill="url(#rueda-centro)" stroke="#B8862B" strokeWidth="1" />
      {/* Flecha (lengüeta de madera) arriba, apuntando hacia adentro */}
      <g transform={`translate(0 -99) rotate(${-lengueta})`}>
        <path d="M -7 0 L 7 0 L 0 17 Z" fill="#EC681B" stroke="#FFFFFF" strokeWidth="1.2" strokeLinejoin="round" />
      </g>
    </svg>
  )
}

function dibujarPorciones(rueda: Persona[]) {
  const n = rueda.length
  const paso = (2 * Math.PI) / Math.max(n, 1)
  const ancho = 2 * Math.PI * 55 / Math.max(n, 1) // lo que mide la porción a mitad del radio
  const largo = R_TEXTO_HASTA - R_TEXTO_DESDE
  return rueda.map((p, i) => {
    // Porción centrada hacia arriba (luego se gira a su lugar).
    const x = Math.sin(paso / 2) * R_PORCION
    const y = -Math.cos(paso / 2) * R_PORCION
    const forma = n === 1 ? `M 0 ${-R_PORCION} A ${R_PORCION} ${R_PORCION} 0 1 1 -0.01 ${-R_PORCION} Z` : `M 0 0 L ${-x} ${y} A ${R_PORCION} ${R_PORCION} 0 0 1 ${x} ${y} Z`
    // Letra: la que entra a lo ancho de la porción y a lo largo del radio; si no entra, se corta.
    const maxPorAncho = Math.min(11, ancho * 0.6)
    let nombre = p.nombre
    let letra = Math.min(maxPorAncho, largo / (nombre.length * 0.56))
    if (letra < 5) {
      letra = Math.min(maxPorAncho, 5)
      const entran = Math.floor(largo / (letra * 0.56))
      nombre = nombre.length > entran ? `${nombre.slice(0, entran - 1).trimEnd()}…` : nombre
    }
    const color = n % 2 === 1 && i === n - 1 && n > 1 ? PORCION_IMPAR : PORCIONES[i % 2]!
    return { forma, letra, nombre, color }
  })
}
