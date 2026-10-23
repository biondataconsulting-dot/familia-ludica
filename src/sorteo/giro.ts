/**
 * Cuentas de la ruleta (sin pantalla, para poder probarlas). La ruleta es un tambor: `posicion` es el
 * renglón que está en el centro (puede ser fraccionario mientras gira). Arranca en 0 y termina en un
 * renglón que, módulo la cantidad de nombres, es el del ganador que eligió la base.
 */

/** Renglones mínimos que recorre la ruleta (para que se vea girar aunque haya pocos nombres). */
const RECORRIDO_MINIMO = 40
/** Al final se pasa un poquito y vuelve, como el tope de madera de una ruleta de circo. */
const PASADA = 0.35
const ASENTAR_S = 0.7

/** Número estable a partir del id del sorteo: la misma tirada se ve igual en todas las pantallas. */
export function semilla(id: string): number {
  let h = 2166136261
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619)
  return h >>> 0
}

/** Cuántos renglones recorre hasta caer en `destino` (índice en la lista de `n` nombres). */
export function recorrido(n: number, destino: number, id: string): number {
  if (n <= 0) return 0
  let d = destino
  while (d < RECORRIDO_MINIMO) d += n
  // Con pocos nombres, a veces una vuelta más: no siempre gira igual.
  if (n < 20 && semilla(id) % 2 === 1) d += n
  return d
}

/** Posición a los `t` segundos de un giro de `total` segundos que recorre `d` renglones. */
export function posicionEn(t: number, total: number, d: number): number {
  if (t <= 0) return 0
  if (t >= total) return d
  const frenado = total - ASENTAR_S
  if (t < frenado) {
    // Arranca rápido y frena cada vez más lento (los últimos renglones pasan de a uno).
    const u = t / frenado
    return (d + PASADA) * (1 - Math.pow(1 - u, 2.6))
  }
  // Vuelve suave al renglón del ganador.
  const v = (t - frenado) / ASENTAR_S
  return d + PASADA * (1 - v * v * (3 - 2 * v))
}

/** Módulo siempre positivo (para los renglones de arriba del primero). */
export const modulo = (a: number, n: number) => ((a % n) + n) % n
