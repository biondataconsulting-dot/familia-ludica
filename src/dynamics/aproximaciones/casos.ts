/**
 * Casos de la fórmula de Aproximaciones, compartidos por el test de TypeScript y la prueba de SQL.
 * `esperado` está calculado a mano.
 */
export const CASOS_APROXIMACION: {
  nombre: string
  correcto: number
  respuestas: { id: string; valor: number }[]
  esperado: Record<string, number>
}[] = [
  {
    nombre: 'reparto general: la más cerca 1.000, la más lejos 0, el resto proporcional',
    correcto: 100,
    // d = 10, 30, 60, 110 → dmin 10, dmax 110
    respuestas: [
      { id: 'a', valor: 110 },
      { id: 'b', valor: 70 },
      { id: 'c', valor: 160 },
      { id: 'd', valor: 210 },
    ],
    // b: 800·(1 − 20/100) = 640 · c: 800·(1 − 50/100) = 400
    esperado: { a: 1000, b: 640, c: 400, d: 0 },
  },
  {
    nombre: 'empate en la mínima: todas las empatadas 1.000',
    correcto: 50,
    respuestas: [
      { id: 'a', valor: 45 },
      { id: 'b', valor: 55 },
      { id: 'c', valor: 70 },
    ],
    esperado: { a: 1000, b: 1000, c: 0 },
  },
  {
    nombre: 'todas iguales: 1.000 para todas',
    correcto: 1986,
    respuestas: [
      { id: 'a', valor: 1990 },
      { id: 'b', valor: 1990 },
      { id: 'c', valor: 1990 },
    ],
    esperado: { a: 1000, b: 1000, c: 1000 },
  },
  {
    nombre: 'todas a la misma distancia (por arriba y por abajo): 1.000',
    correcto: 10,
    respuestas: [
      { id: 'a', valor: 7 },
      { id: 'b', valor: 13 },
    ],
    esperado: { a: 1000, b: 1000 },
  },
  {
    nombre: 'una sola respuesta: 1.000',
    correcto: 6961,
    respuestas: [{ id: 'a', valor: 5000 }],
    esperado: { a: 1000 },
  },
  {
    nombre: 'respuesta exacta: 1.000 y el resto según su distancia',
    correcto: 1936,
    // d = 0, 4, 14, 64
    respuestas: [
      { id: 'a', valor: 1936 },
      { id: 'b', valor: 1940 },
      { id: 'c', valor: 1950 },
      { id: 'd', valor: 2000 },
    ],
    // b: 800·(1 − 4/64) = 750 · c: 800·(1 − 14/64) = 625
    esperado: { a: 1000, b: 750, c: 625, d: 0 },
  },
  {
    nombre: 'redondeo y decimales',
    correcto: 3.5,
    // d = 0.5, 1, 2.5 → b: 800·(1 − 0.5/2) = 600
    respuestas: [
      { id: 'a', valor: 3 },
      { id: 'b', valor: 4.5 },
      { id: 'c', valor: 6 },
    ],
    esperado: { a: 1000, b: 600, c: 0 },
  },
  {
    nombre: 'redondeo de medios: 800·(1 − 1/3) = 533,3 → 533',
    correcto: 0,
    respuestas: [
      { id: 'a', valor: 1 },
      { id: 'b', valor: 2 },
      { id: 'c', valor: 4 },
    ],
    esperado: { a: 1000, b: 533, c: 0 },
  },
]
