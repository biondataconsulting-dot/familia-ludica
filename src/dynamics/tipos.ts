export type MetaDinamica = {
  clave: string
  /** Nombre por defecto; en pantalla manda el título del bloque (ej.: "Hipster de películas"). */
  nombre: string
  /** Cómo se juega, 1 o 2 líneas, para la presentación del bloque en el proyector. */
  comoSeJuega: string
  /** Instrucción corta para el celular. */
  instruccionCelular: string
  /** Cómo se llama cada ítem en la barra: "pregunta 3 de 8", "canción 3 de 8". */
  sustantivo: string
  tipos: string[]
}
