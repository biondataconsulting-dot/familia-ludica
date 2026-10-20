import type { Dinamica } from '../tipos'
import { meta } from './meta'
import { PhoneInput } from './PhoneInput'
import { ProjectorOpen } from './ProjectorOpen'
import { ProjectorReveal } from './ProjectorReveal'
import { describir, validar } from './validate'

export const aproximaciones: Dinamica = {
  meta,
  PhoneInput,
  ProjectorOpen,
  ProjectorReveal,
  validar,
  describir,
  instruccion: (item) => (item.content.formato === 'anio' ? '¿En qué año?' : meta.instruccionCelular),
}
