import type { Dinamica } from '../tipos'
import { meta } from './meta'
import { PhoneInput } from './PhoneInput'
import { ProjectorOpen } from './ProjectorOpen'
import { ProjectorReveal } from './ProjectorReveal'
import { describir, validar } from './validate'

export const dosVerdades: Dinamica = { meta, PhoneInput, ProjectorOpen, ProjectorReveal, validar, describir }
