/**
 * Casos de validación de texto de Hitster, compartidos por el test de TypeScript y la prueba de SQL.
 * `estado` puede admitir más de un resultado cuando la spec lo deja abierto ("aceptada o dudosa").
 */
export const CASOS_TEXTO: { nombre: string; respuesta: string; opciones: string[]; estado: string[] }[] = [
  { nombre: 'igual pero con mayúsculas', respuesta: 'persiana americana', opciones: ['Persiana americana'], estado: ['auto_ok'] },
  { nombre: 'artículo inicial y tildes', respuesta: 'La Canción Animal', opciones: ['Canción animal'], estado: ['auto_ok'] },
  { nombre: 'signos y espacios de más', respuesta: '  ¡De  música  ligera!  ', opciones: ['De música ligera'], estado: ['auto_ok'] },
  {
    nombre: 'spec: "Soda Estereo" contra "Soda Stereo" queda aceptada o dudosa',
    respuesta: 'Soda Estereo',
    opciones: ['Soda Stereo', 'Soda'],
    estado: ['auto_ok', 'dudosa'],
  },
  { nombre: 'error de tipeo chico', respuesta: 'Rick Astly', opciones: ['Rick Astley'], estado: ['auto_ok', 'dudosa'] },
  {
    nombre: 'variante: el apodo de la banda',
    respuesta: 'los redondos',
    opciones: ['Patricio Rey y sus Redonditos de Ricota', 'Los Redondos'],
    estado: ['auto_ok'],
  },
  { nombre: 'título a medias', respuesta: 'Bohemian', opciones: ['Bohemian Rhapsody'], estado: ['dudosa', 'auto_no'] },
  { nombre: 'nada que ver', respuesta: 'Los Piojos', opciones: ['Soda Stereo', 'Soda'], estado: ['auto_no'] },
  { nombre: 'artistas con símbolo', respuesta: 'acdc', opciones: ['AC/DC'], estado: ['dudosa', 'auto_no'] },
  { nombre: 'artistas con símbolo, separado', respuesta: 'AC DC', opciones: ['AC/DC'], estado: ['auto_ok'] },
]
