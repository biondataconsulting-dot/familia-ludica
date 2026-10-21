import { consigna } from '../solucion'
import type { Dinamica } from '../tipos'
import { meta } from './meta'
import { PhoneInput } from './PhoneInput'
import { ProjectorOpen } from './ProjectorOpen'
import { ProjectorReveal } from './ProjectorReveal'
import { describir, resultado, validar } from './validate'

/** Adiviná la imagen: logos, película con emojis, ¿Qué ves? Una respuesta escrita, validada como Hitster. */
export const imagen: Dinamica = {
  meta,
  PhoneInput,
  ProjectorOpen,
  ProjectorReveal,
  validar,
  describir,
  resultado,
  instruccion: (item) => consigna(item.type, item.content),
}
