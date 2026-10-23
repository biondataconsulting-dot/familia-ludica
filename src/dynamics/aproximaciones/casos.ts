/**
 * Casos de la fórmula de Aproximaciones (por puesto), compartidos por el test de TypeScript y la prueba de
 * SQL. `esperado` está calculado a mano: 1° 1.000 · 2° 700 · 3° 500 · 4° 300 · 5° y siguientes 100.
 */
export const CASOS_APROXIMACION: {
  nombre: string
  correcto: number
  respuestas: { id: string; valor: number }[]
  esperado: Record<string, number>
}[] = [
  {
    nombre: 'reparto general por puesto',
    correcto: 100,
    // d = 10, 30, 60, 110
    respuestas: [
      { id: 'a', valor: 110 },
      { id: 'b', valor: 70 },
      { id: 'c', valor: 160 },
      { id: 'd', valor: 210 },
    ],
    esperado: { a: 1000, b: 700, c: 500, d: 300 },
  },
  {
    nombre: 'la prueba del 21/10: dos empatadas en el 2° puesto suman 700 cada una',
    correcto: 450,
    // d = 50, 50, 20
    respuestas: [
      { id: 'naty', valor: 400 },
      { id: 'agus', valor: 400 },
      { id: 'jor', valor: 430 },
    ],
    esperado: { jor: 1000, naty: 700, agus: 700 },
  },
  {
    nombre: 'empate en el 1° puesto: las dos 1.000 y la siguiente es 3°',
    correcto: 50,
    respuestas: [
      { id: 'a', valor: 45 },
      { id: 'b', valor: 55 },
      { id: 'c', valor: 70 },
    ],
    esperado: { a: 1000, b: 1000, c: 500 },
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
    nombre: 'una sola respuesta: 1.000',
    correcto: 6961,
    respuestas: [{ id: 'a', valor: 5000 }],
    esperado: { a: 1000 },
  },
  {
    nombre: 'del 5° puesto en adelante: 100',
    correcto: 1936,
    // d = 0, 4, 14, 64, 70, 100
    respuestas: [
      { id: 'a', valor: 1936 },
      { id: 'b', valor: 1940 },
      { id: 'c', valor: 1950 },
      { id: 'd', valor: 2000 },
      { id: 'e', valor: 1866 },
      { id: 'f', valor: 2036 },
    ],
    esperado: { a: 1000, b: 700, c: 500, d: 300, e: 100, f: 100 },
  },
  {
    nombre: 'decimales',
    correcto: 3.5,
    // d = 0.5, 1, 2.5
    respuestas: [
      { id: 'a', valor: 3 },
      { id: 'b', valor: 4.5 },
      { id: 'c', valor: 6 },
    ],
    esperado: { a: 1000, b: 700, c: 500 },
  },
]
