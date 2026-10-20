import { PhoneInput } from '../hipster/PhoneInput'
import { describir, resultado, validar } from '../hipster/validate'
import type { Dinamica } from '../tipos'
import { meta } from './meta'
import { ProjectorOpen } from './ProjectorOpen'
import { ProjectorReveal } from './ProjectorReveal'

/** Cine y series: igual que Hipster (año, título y director), pero la escena se ve en el proyector. */
export const cine: Dinamica = {
  meta,
  PhoneInput,
  ProjectorOpen,
  ProjectorReveal,
  validar,
  describir,
  resultado: (detail, puntos) => resultado(detail, puntos, 'Director'),
}
