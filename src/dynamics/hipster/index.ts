import type { Dinamica } from '../tipos'
import { meta } from './meta'
import { PhoneInput } from './PhoneInput'
import { ProjectorOpen } from './ProjectorOpen'
import { ProjectorReveal } from './ProjectorReveal'
import { describir, resultado, validar } from './validate'

export const hipster: Dinamica = { meta, PhoneInput, ProjectorOpen, ProjectorReveal, validar, describir, resultado }
