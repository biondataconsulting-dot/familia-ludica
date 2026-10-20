/**
 * Validación de ítems del catálogo. La que manda es la de SQL (private.error_item); esta copia da los
 * mismos mensajes para mostrarlos antes de guardar o importar. Casos compartidos: casos-items.ts.
 */

export const TIPOS = ['pregunta_opciones', 'trio_verdad_mentira', 'pregunta_numerica', 'pista_audio', 'clip_video'] as const
export type TipoItem = (typeof TIPOS)[number]

export const NOMBRE_TIPO: Record<TipoItem, string> = {
  pregunta_opciones: 'Pregunta con opciones',
  trio_verdad_mentira: 'Dos verdades y una mentira',
  pregunta_numerica: 'Pregunta numérica',
  pista_audio: 'Canción (YouTube)',
  clip_video: 'Clip de video (YouTube)',
}

/** Qué tipos de ítem acepta cada dinámica (igual que private.tipo_va_en). */
export const TIPOS_POR_DINAMICA: Record<string, TipoItem[]> = {
  trivia: ['pregunta_opciones'],
  dos_verdades: ['trio_verdad_mentira'],
  aproximaciones: ['pregunta_numerica'],
  hipster: ['pista_audio', 'clip_video'],
}

type Obj = Record<string, unknown>

const esObjeto = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v)
const esEntero = (v: unknown, min: number, max: number) => typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max
const textoLleno = (v: unknown) => typeof v === 'string' && v.trim() !== ''
const listaDeTextos = (v: unknown): v is string[] => Array.isArray(v) && v.every((x) => typeof x === 'string')

/** null si está bien; si no, qué está mal (mismo texto que la base). */
export function validarItem(tipo: unknown, c: unknown, s: unknown): string | null {
  if (typeof tipo !== 'string' || !(TIPOS as readonly string[]).includes(tipo)) {
    return `Tipo desconocido: «${typeof tipo === 'string' ? tipo : ''}». Usá pregunta_opciones, trio_verdad_mentira, pregunta_numerica, pista_audio o clip_video.`
  }
  if (!esObjeto(c)) return 'Falta el contenido.'
  if (!esObjeto(s)) return 'Falta la solución.'

  switch (tipo as TipoItem) {
    case 'pregunta_opciones': {
      if (!textoLleno(c.texto)) return 'Falta el texto de la pregunta.'
      if (!listaDeTextos(c.opciones)) return 'Faltan las opciones (una lista de textos).'
      const n = c.opciones.length
      if (n < 2 || n > 6) return 'Tiene que haber entre 2 y 6 opciones.'
      if (c.opciones.some((o) => o.trim() === '')) return 'Hay una opción vacía.'
      if (!esEntero(s.correcta, 0, n - 1)) return `«correcta» tiene que ser la posición de la opción correcta: un número de 0 a ${n - 1}.`
      return null
    }
    case 'trio_verdad_mentira': {
      if (!listaDeTextos(c.afirmaciones) || c.afirmaciones.length !== 3) return 'Tiene que haber exactamente 3 afirmaciones.'
      if (c.afirmaciones.some((o) => o.trim() === '')) return 'Hay una afirmación vacía.'
      if (!esEntero(s.mentira, 0, 2)) return '«mentira» tiene que ser 0, 1 o 2 (la posición de la mentira).'
      return null
    }
    case 'pregunta_numerica': {
      if (!textoLleno(c.texto)) return 'Falta el texto de la pregunta.'
      const formato = c.formato ?? 'numero'
      if (formato !== 'numero' && formato !== 'anio') return '«formato» tiene que ser numero o anio.'
      if (typeof s.valor !== 'number') return 'Falta el valor correcto (un número).'
      if (c.formato === 'anio' && !esEntero(s.valor, -9999, 9999)) return 'Si la respuesta es un año, el valor tiene que ser un año entero.'
      return null
    }
    default: {
      const anioActual = new Date().getFullYear()
      if (typeof c.youtube_id !== 'string' || !/^[A-Za-z0-9_-]{11}$/.test(c.youtube_id)) {
        return 'El youtube_id tiene que tener 11 caracteres (letras, números, - o _).'
      }
      if ('inicio' in c && !esEntero(c.inicio, 0, 36000)) return '«inicio» tiene que ser los segundos donde empieza el fragmento (entero, 0 o más).'
      if ('duracion' in c && !esEntero(c.duracion, 5, 120)) return '«duracion» tiene que ser de 5 a 120 segundos.'
      if (!['musica', 'pelicula', 'serie', 'dibujo'].includes(String(c.categoria ?? 'musica'))) {
        return '«categoria» tiene que ser musica, pelicula, serie o dibujo.'
      }
      if (!esEntero(s.anio, 1900, anioActual)) return `El año tiene que estar entre 1900 y ${anioActual}.`
      if (!textoLleno(s.titulo)) return 'Falta el título.'
      if (tipo === 'pista_audio' && !textoLleno(s.artista)) return 'Falta el artista.'
      if ('variantes_titulo' in s && !listaDeTextos(s.variantes_titulo)) return '«variantes_titulo» tiene que ser una lista de textos.'
      if ('variantes_artista' in s && !listaDeTextos(s.variantes_artista)) return '«variantes_artista» tiene que ser una lista de textos.'
      return null
    }
  }
}

/** Saca el id de 11 caracteres de un link de YouTube (watch, youtu.be, shorts, embed) o lo deja si ya es un id. */
export function idDeYouTube(texto: string): string {
  const t = texto.trim()
  const m = t.match(/(?:v=|youtu\.be\/|shorts\/|embed\/)([A-Za-z0-9_-]{11})/)
  return m?.[1] ?? t
}
