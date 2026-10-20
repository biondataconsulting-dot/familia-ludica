import { useState } from 'react'

type Props = {
  /** Clases del panel: el ancho (≥ 140 px en pantalla, ver docs/MARCA.md) y posición. */
  className?: string
}

/**
 * Logo oficial sobre panel blanco (manual de marca §4.1–4.3):
 * nunca sobre azul ni foto, sin rotar, sin efectos, nunca recreado con tipografía.
 * El margen del 14% del ancho del panel deja el área de seguridad (≥ altura de la estrella).
 * Va como margin del hijo porque los % se miden contra el ancho del padre.
 */
export function Logo({ className = '' }: Props) {
  const [falta, setFalta] = useState(false)
  const area = { width: '72%', margin: '14%' }

  return (
    <div className={`flow-root rounded-carta bg-white ${className}`}>
      {falta ? (
        <div className="aspect-[151/155]" style={area} role="img" aria-label="Familia Lúdica" />
      ) : (
        <img
          src="/brand/logo.png"
          alt="Familia Lúdica"
          width={151}
          height={155}
          className="block h-auto"
          style={area}
          onError={() => setFalta(true)}
        />
      )}
    </div>
  )
}
