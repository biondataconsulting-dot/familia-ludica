/**
 * Casos de validación de ítems, compartidos por el test de TypeScript y la prueba de SQL.
 * `error`: null si el ítem es válido; si no, un pedazo del mensaje esperado.
 */
export const CASOS_ITEMS: { nombre: string; tipo: string; contenido: unknown; solucion: unknown; error: string | null }[] = [
  {
    nombre: 'trivia válida',
    tipo: 'pregunta_opciones',
    contenido: { texto: '¿Cuántas fichas tiene un dominó?', opciones: ['28', '32', '24', '36'] },
    solucion: { correcta: 0, explicacion: 'Doble seis.' },
    error: null,
  },
  { nombre: 'tipo desconocido', tipo: 'emojis', contenido: {}, solucion: {}, error: 'Tipo desconocido' },
  { nombre: 'sin contenido', tipo: 'pregunta_opciones', contenido: null, solucion: {}, error: 'Falta el contenido' },
  { nombre: 'trivia sin texto', tipo: 'pregunta_opciones', contenido: { opciones: ['a', 'b'] }, solucion: { correcta: 0 }, error: 'Falta el texto' },
  { nombre: 'trivia con 1 opción', tipo: 'pregunta_opciones', contenido: { texto: 'x', opciones: ['a'] }, solucion: { correcta: 0 }, error: 'entre 2 y 6' },
  { nombre: 'trivia con opción vacía', tipo: 'pregunta_opciones', contenido: { texto: 'x', opciones: ['a', ' '] }, solucion: { correcta: 0 }, error: 'opción vacía' },
  { nombre: 'trivia con correcta fuera de rango', tipo: 'pregunta_opciones', contenido: { texto: 'x', opciones: ['a', 'b'] }, solucion: { correcta: 2 }, error: 'de 0 a 1' },
  { nombre: 'trivia con correcta como texto', tipo: 'pregunta_opciones', contenido: { texto: 'x', opciones: ['a', 'b'] }, solucion: { correcta: '1' }, error: 'de 0 a 1' },
  {
    nombre: 'dos verdades válida',
    tipo: 'trio_verdad_mentira',
    contenido: { afirmaciones: ['a', 'b', 'c'] },
    solucion: { mentira: 2 },
    error: null,
  },
  { nombre: 'dos verdades con 2 afirmaciones', tipo: 'trio_verdad_mentira', contenido: { afirmaciones: ['a', 'b'] }, solucion: { mentira: 1 }, error: 'exactamente 3' },
  { nombre: 'dos verdades con mentira 3', tipo: 'trio_verdad_mentira', contenido: { afirmaciones: ['a', 'b', 'c'] }, solucion: { mentira: 3 }, error: '0, 1 o 2' },
  { nombre: 'numérica válida', tipo: 'pregunta_numerica', contenido: { texto: 'x', unidad: 'km' }, solucion: { valor: 12.5 }, error: null },
  { nombre: 'numérica de año con decimales', tipo: 'pregunta_numerica', contenido: { texto: 'x', formato: 'anio' }, solucion: { valor: 1936.5 }, error: 'año entero' },
  { nombre: 'numérica sin valor', tipo: 'pregunta_numerica', contenido: { texto: 'x' }, solucion: {}, error: 'Falta el valor' },
  {
    nombre: 'canción válida',
    tipo: 'pista_audio',
    contenido: { youtube_id: 'dQw4w9WgXcQ', inicio: 42, duracion: 20, categoria: 'musica' },
    solucion: { anio: 1987, titulo: 'Never Gonna Give You Up', artista: 'Rick Astley', variantes_titulo: [], variantes_artista: ['Rick'] },
    error: null,
  },
  { nombre: 'youtube_id corto', tipo: 'pista_audio', contenido: { youtube_id: 'abc' }, solucion: { anio: 1987, titulo: 't', artista: 'a' }, error: '11 caracteres' },
  { nombre: 'año antes de 1900', tipo: 'pista_audio', contenido: { youtube_id: 'dQw4w9WgXcQ' }, solucion: { anio: 1850, titulo: 't', artista: 'a' }, error: 'entre 1900' },
  { nombre: 'año en el futuro', tipo: 'pista_audio', contenido: { youtube_id: 'dQw4w9WgXcQ' }, solucion: { anio: 2999, titulo: 't', artista: 'a' }, error: 'entre 1900' },
  { nombre: 'canción sin artista', tipo: 'pista_audio', contenido: { youtube_id: 'dQw4w9WgXcQ' }, solucion: { anio: 1987, titulo: 't' }, error: 'Falta el artista' },
  { nombre: 'escena sin director', tipo: 'clip_video', contenido: { youtube_id: 'dQw4w9WgXcQ', categoria: 'pelicula' }, solucion: { anio: 1987, titulo: 't' }, error: 'Falta el director' },
  {
    nombre: 'escena válida (artista = director)',
    tipo: 'clip_video',
    contenido: { youtube_id: 'dQw4w9WgXcQ', duracion: 30, categoria: 'pelicula' },
    solucion: { anio: 1985, titulo: 'Volver al futuro', artista: 'Robert Zemeckis', variantes_titulo: ['Back to the Future'] },
    error: null,
  },
  { nombre: 'duración larguísima', tipo: 'pista_audio', contenido: { youtube_id: 'dQw4w9WgXcQ', duracion: 600 }, solucion: { anio: 1987, titulo: 't', artista: 'a' }, error: '5 a 120' },
  { nombre: 'categoría inventada', tipo: 'clip_video', contenido: { youtube_id: 'dQw4w9WgXcQ', categoria: 'novela' }, solucion: { anio: 1987, titulo: 't', artista: 'd' }, error: 'categoria' },
  { nombre: 'variantes que no son lista', tipo: 'pista_audio', contenido: { youtube_id: 'dQw4w9WgXcQ' }, solucion: { anio: 1987, titulo: 't', artista: 'a', variantes_artista: 'x' }, error: 'variantes_artista' },
]
