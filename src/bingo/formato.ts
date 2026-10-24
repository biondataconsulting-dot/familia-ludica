/**
 * Formato de los cartones del bingo musical (igual que private.bingo_* en la base, que los vuelve a validar).
 * · express: canciones 1–40, 3 filas × 5 columnas, 3 por fila (9 en total); columnas de 8 números.
 * · full: canciones 1–90, 3 filas × 9 columnas, 5 por fila (15 en total); columnas por decena (1–9 … 80–90).
 * Cada columna tiene de 1 a 3 números, de menor a mayor de arriba hacia abajo (como un cartón de verdad).
 */

export type TipoBingo = 'express' | 'full'
/** Tres filas; cada una con sus números de menor a mayor. */
export type Carton = number[][]

export const FORMATO: Record<TipoBingo, { nombre: string; letra: string; pool: number; columnas: number; porFila: number; minutos: string }> = {
  express: { nombre: 'Express', letra: 'A', pool: 40, columnas: 5, porFila: 3, minutos: '~15 min' },
  full: { nombre: 'Full', letra: 'C', pool: 90, columnas: 9, porFila: 5, minutos: '~30 min' },
}

export function columna(tipo: TipoBingo, n: number): number {
  return tipo === 'express' ? Math.floor((n - 1) / 8) : Math.min(Math.floor(n / 10), 8)
}

export function rango(tipo: TipoBingo, c: number): [number, number] {
  if (tipo === 'express') return [c * 8 + 1, c * 8 + 8]
  if (c === 0) return [1, 9]
  if (c === 8) return [80, 90]
  return [c * 10, c * 10 + 9]
}

/** "A-007" / "C-012": letra del tipo y número de cartón. */
export const codigoCarton = (tipo: TipoBingo, numero: number) => `${FORMATO[tipo].letra}-${String(numero).padStart(3, '0')}`

function mezclar<T>(lista: T[], azar: () => number): T[] {
  const a = [...lista]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(azar() * (i + 1))
    ;[a[i], a[j]] = [a[j]!, a[i]!]
  }
  return a
}

function uno(tipo: TipoBingo, azar: () => number): Carton {
  const { columnas, porFila } = FORMATO[tipo]
  for (;;) {
    const filas = [0, 1, 2].map(() => mezclar([...Array(columnas).keys()], azar).slice(0, porFila))
    const porCol = [...Array(columnas).keys()].map((c) => filas.filter((f) => f.includes(c)).length)
    if (porCol.some((n) => n < 1)) continue
    // Números de cada columna, de menor a mayor de arriba hacia abajo.
    const nums = porCol.map((cant, c) => {
      const [a, b] = rango(tipo, c)
      return mezclar(
        Array.from({ length: b - a + 1 }, (_, i) => a + i),
        azar,
      )
        .slice(0, cant)
        .sort((x, y) => x - y)
    })
    const usados = new Array<number>(columnas).fill(0)
    return filas.map((f) =>
      [...f]
        .sort((x, y) => x - y)
        .map((c) => nums[c]![usados[c]!++]!)
        .sort((x, y) => x - y),
    )
  }
}

/**
 * `cantidad` cartones todos distintos. Además, ningún par de cartones comparte una fila entera (así es
 * menos probable que dos canten línea con la misma canción).
 */
export function generarCartones(tipo: TipoBingo, cantidad: number, azar: () => number = Math.random): Carton[] {
  const cartones: Carton[] = []
  const vistos = new Set<string>()
  const filasVistas = new Set<string>()
  let intentos = 0
  while (cartones.length < cantidad) {
    if (++intentos > cantidad * 500) throw new Error('No se pudieron armar tantos cartones distintos.')
    const c = uno(tipo, azar)
    const clave = c.flat().sort((a, b) => a - b).join(',')
    const filas = c.map((f) => f.join(','))
    if (vistos.has(clave) || filas.some((f) => filasVistas.has(f))) continue
    vistos.add(clave)
    filas.forEach((f) => filasVistas.add(f))
    cartones.push(c)
  }
  return cartones
}
