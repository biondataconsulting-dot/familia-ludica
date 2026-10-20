/** Texto legible de la solución de un ítem, para el panel del conductor y el revelado. */

const LETRAS = ['A', 'B', 'C', 'D', 'E', 'F']

type Contenido = Record<string, unknown>

const texto = (v: unknown) => (typeof v === 'string' || typeof v === 'number' ? String(v) : '')
const lista = (v: unknown) => (Array.isArray(v) ? v.map(texto) : [])

export function letraOpcion(indice: number): string {
  return LETRAS[indice] ?? String(indice + 1)
}

export function formatearNumero(n: number): string {
  return new Intl.NumberFormat('es-AR', { maximumFractionDigits: 2 }).format(n)
}

export function describirSolucion(tipo: string, contenido: Contenido, solucion: Contenido): string {
  switch (tipo) {
    case 'pregunta_opciones': {
      const i = Number(solucion.correcta)
      return `${letraOpcion(i)}. ${lista(contenido.opciones)[i] ?? '?'}`
    }
    case 'trio_verdad_mentira': {
      const i = Number(solucion.mentira)
      return `La mentira es la ${i + 1}: ${lista(contenido.afirmaciones)[i] ?? '?'}`
    }
    case 'pregunta_numerica': {
      const valor = Number(solucion.valor)
      const unidad = texto(contenido.unidad)
      const n = contenido.formato === 'anio' ? String(valor) : formatearNumero(valor)
      return unidad ? `${n} ${unidad}` : n
    }
    case 'pista_audio':
    case 'clip_video':
      return [texto(solucion.anio), texto(solucion.titulo), texto(solucion.artista)].filter(Boolean).join(' · ')
    default:
      return JSON.stringify(solucion)
  }
}

/** Consigna principal del ítem (lo que se lee en grande). */
export function consigna(tipo: string, contenido: Contenido): string {
  if (tipo === 'trio_verdad_mentira') return '¿Cuál es la mentira?'
  if (tipo === 'pista_audio') return '¿De qué año es esta canción?'
  if (tipo === 'clip_video') return '¿De qué año es?'
  return texto(contenido.texto)
}
