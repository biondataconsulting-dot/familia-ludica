import type { ItemActual } from '../../lib/tipos'
import type { Respuesta } from '../tipos'

export function validar(_item: ItemActual, r: Respuesta | null): string | null {
  const anio = r?.anio
  if (typeof anio !== 'number' || !Number.isInteger(anio)) return 'Elegí el año antes de enviar.'
  if (anio < 1800 || anio > 2100) return 'Ese año no es válido. Elegí uno entre 1800 y 2100.'
  for (const campo of ['titulo', 'artista'] as const) {
    const v = r?.[campo]
    if (typeof v === 'string' && v.length > 100) return 'El título y el artista pueden tener hasta 100 caracteres.'
  }
  return null
}

export function describir(_contenido: Record<string, unknown>, r: Respuesta): string {
  return [r.anio, r.titulo, r.artista].filter((x) => x !== undefined && x !== '').join(' · ')
}

const ESTADO: Record<string, string> = { auto_ok: '✔', aceptada: '✔', dudosa: '?', auto_no: '✘', rechazada: '✘' }

/** Lo que ve la mesa al revelar: año (con su diferencia) y si le aceptaron título y artista. */
export function resultado(detail: Record<string, unknown>, puntos: number): { titulo: string; lineas: string[] } {
  const dif = Number(detail.diferencia)
  const lineas = [dif === 0 ? 'Año exacto: +600' : `Año: ${dif} de diferencia → +${Math.max(0, 600 - 75 * dif)}`]
  for (const [campo, nombre] of [
    ['titulo', 'Título'],
    ['artista', 'Artista'],
  ] as const) {
    const e = detail[campo]
    if (typeof e === 'string') lineas.push(`${nombre} ${ESTADO[e] ?? ''} ${e === 'auto_ok' || e === 'aceptada' ? '+200' : '+0'}`)
  }
  return { titulo: dif === 0 ? '¡Clavaron el año!' : puntos > 0 ? '¡Bien cerca!' : 'Esta vez no', lineas }
}
