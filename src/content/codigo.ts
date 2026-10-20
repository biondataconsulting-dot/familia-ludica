const RELLENO = new Set(['noche', 'noches', 'de', 'del', 'la', 'las', 'el', 'los', 'en', 'y', 'juegos', 'juego', 'edicion', 'especial', 'una', 'un'])

/**
 * Código sugerido a partir del nombre: palabras con significado, sin tildes, en mayúsculas,
 * de 3 a 12 letras o números. "Noche de Juegos en Naudir — 3ra Edición" → "NAUDIR3".
 */
export function sugerirCodigo(nombre: string): string {
  const palabras = nombre
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
  const utiles = palabras.filter((p) => !RELLENO.has(p))
  const numero = utiles.map((p) => p.match(/^(\d+)/)?.[1]).find(Boolean) ?? ''
  const texto = utiles.filter((p) => !/^\d/.test(p)).join('')
  let codigo = (texto.slice(0, 12 - numero.length) + numero).toUpperCase()
  if (codigo.length < 3) codigo = (codigo + 'NOCHE').slice(0, Math.max(3, codigo.length + 5)).toUpperCase()
  return codigo.slice(0, 12)
}
