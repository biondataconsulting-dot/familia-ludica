import { validarItem } from './validarItem'

/**
 * Lectura de archivos para importar (spec §10).
 * JSON: [{tipo, etiquetas, dificultad, contenido, solucion}].
 * CSV: columnas tipo, etiquetas (separadas por |), dificultad, contenido_json, solucion_json.
 */

export type ItemImportado = {
  tipo: string
  etiquetas: string[]
  dificultad?: string
  contenido: Record<string, unknown>
  solucion: Record<string, unknown>
}

export type FilaImportada = { fila: number; item: ItemImportado | null; error: string | null }

export function leerImportacion(texto: string): { filas: FilaImportada[]; error: string | null } {
  const t = texto.replace(/^\uFEFF/, '').trim()
  if (!t) return { filas: [], error: 'El archivo está vacío.' }
  return t.startsWith('[') || t.startsWith('{') ? leerJson(t) : leerCsv(t)
}

function leerJson(t: string) {
  let datos: unknown
  try {
    datos = JSON.parse(t)
  } catch (e) {
    return { filas: [], error: `El JSON no es válido: ${(e as Error).message}` }
  }
  if (!Array.isArray(datos)) return { filas: [], error: 'El JSON tiene que ser una lista: [ {…}, {…} ].' }
  return { filas: datos.map((d, i) => armarFila(i + 1, d)), error: null }
}

function armarFila(fila: number, d: unknown): FilaImportada {
  if (typeof d !== 'object' || d === null || Array.isArray(d)) return { fila, item: null, error: 'La fila no es un objeto {…}.' }
  const o = d as Record<string, unknown>
  const etiquetas = Array.isArray(o.etiquetas) ? o.etiquetas.map(String).map((x) => x.trim()).filter(Boolean) : []
  const error = validarItem(o.tipo, o.contenido, o.solucion)
  const item: ItemImportado = {
    tipo: String(o.tipo ?? ''),
    etiquetas,
    dificultad: typeof o.dificultad === 'string' && o.dificultad.trim() ? o.dificultad.trim() : undefined,
    contenido: (o.contenido ?? {}) as Record<string, unknown>,
    solucion: (o.solucion ?? {}) as Record<string, unknown>,
  }
  return { fila, item: error ? null : item, error }
}

const COLUMNAS = ['tipo', 'etiquetas', 'dificultad', 'contenido_json', 'solucion_json'] as const

function leerCsv(t: string) {
  const primera = t.split(/\r?\n/, 1)[0] ?? ''
  const separador = (primera.match(/;/g)?.length ?? 0) > (primera.match(/,/g)?.length ?? 0) ? ';' : ','
  const registros = parsearCsv(t, separador)
  const encabezado = (registros.shift() ?? []).map((h) => h.trim().toLowerCase())
  const faltan = COLUMNAS.filter((c) => !encabezado.includes(c))
  if (faltan.length) return { filas: [], error: `Al CSV le faltan columnas: ${faltan.join(', ')}. Tiene que tener ${COLUMNAS.join(', ')}.` }
  const col = (r: string[], c: (typeof COLUMNAS)[number]) => r[encabezado.indexOf(c)] ?? ''

  const filas = registros
    .filter((r) => r.some((x) => x.trim() !== ''))
    .map((r, i): FilaImportada => {
      const fila = i + 1
      let contenido: unknown
      let solucion: unknown
      try {
        contenido = JSON.parse(col(r, 'contenido_json'))
      } catch {
        return { fila, item: null, error: 'contenido_json no es un JSON válido.' }
      }
      try {
        solucion = JSON.parse(col(r, 'solucion_json'))
      } catch {
        return { fila, item: null, error: 'solucion_json no es un JSON válido.' }
      }
      return armarFila(fila, {
        tipo: col(r, 'tipo').trim(),
        etiquetas: col(r, 'etiquetas').split('|'),
        dificultad: col(r, 'dificultad'),
        contenido,
        solucion,
      })
    })
  return { filas, error: null }
}

/** CSV con comillas ("…", con "" para una comilla adentro) y saltos de línea dentro de campos. */
export function parsearCsv(texto: string, sep = ','): string[][] {
  const filas: string[][] = []
  let fila: string[] = []
  let campo = ''
  let entreComillas = false
  for (let i = 0; i < texto.length; i++) {
    const ch = texto[i]
    if (entreComillas) {
      if (ch === '"' && texto[i + 1] === '"') {
        campo += '"'
        i++
      } else if (ch === '"') entreComillas = false
      else campo += ch
    } else if (ch === '"') entreComillas = true
    else if (ch === sep) {
      fila.push(campo)
      campo = ''
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && texto[i + 1] === '\n') i++
      fila.push(campo)
      filas.push(fila)
      fila = []
      campo = ''
    } else campo += ch
  }
  if (campo !== '' || fila.length) {
    fila.push(campo)
    filas.push(fila)
  }
  return filas
}
