import type { Dinamica } from '../tipos'
import { meta } from './meta'
import { PhoneInput } from './PhoneInput'
import { ProjectorOpen } from './ProjectorOpen'
import { ProjectorReveal } from './ProjectorReveal'
import { describir, resultado, validar } from './validate'

/** Oveja Oveja (versión local de Herd Mentality): suman las mesas que coinciden con la mayoría. */
export const oveja: Dinamica = { meta, PhoneInput, ProjectorOpen, ProjectorReveal, validar, describir, resultado }
