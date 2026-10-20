import type { ComponentType } from 'react'
import type { ItemActual, Revelado } from '../lib/tipos'

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

/** Respuesta de una mesa: la forma la define cada dinámica (y la valida la base). */
export type Respuesta = Record<string, unknown>

export type PropsPhoneInput = {
  item: ItemActual
  valor: Respuesta | null
  onCambiar: (r: Respuesta) => void
}

export type PropsProyector = {
  item: ItemActual
  /** Solo en el revelado. */
  solucion?: Record<string, unknown>
  /** Solo en el revelado: puntos y detalle por mesa (ej.: quién quedó más cerca). */
  puntos?: Revelado['points']
}

/** Contrato de una dinámica en el frontend (spec §7). El motor no conoce los detalles. */
export type Dinamica = {
  meta: MetaDinamica
  PhoneInput: ComponentType<PropsPhoneInput>
  ProjectorOpen: ComponentType<PropsProyector>
  ProjectorReveal: ComponentType<PropsProyector>
  /** null si la respuesta está completa; si no, qué falta (en español). */
  validar: (item: ItemActual, r: Respuesta | null) => string | null
  /** Título del formulario si depende del ítem (ej.: "¿En qué año?"); si no, meta.instruccionCelular. */
  instruccion?: (item: ItemActual) => string
  /** Texto corto de una respuesta, para "Enviaron: …" y el panel del conductor. */
  describir: (contenido: Record<string, unknown>, r: Respuesta) => string
}
