import type { CSSProperties } from 'react'

/**
 * Tamaño de la imagen del bloque especial en el escenario del proyector (unidades cqw), según la escala en %
 * (100 = el tamaño de siempre). Si no entra, se achica sola para no tapar el título (`min-h-0` en el flex).
 */
export function estiloImagenEspecial(escala: number | null | undefined): CSSProperties {
  const k = (escala ?? 100) / 100
  return { height: `${24 * k}cqw`, maxWidth: `${Math.min(70 * k, 90)}cqw` }
}
