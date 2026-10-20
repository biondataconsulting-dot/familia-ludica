import { aproximaciones } from './aproximaciones'
import { dosVerdades } from './dos_verdades'
import { meta as hipster } from './hipster/meta'
import type { Dinamica, MetaDinamica } from './tipos'
import { trivia } from './trivia'

/** Dinámicas jugables (con formulario, proyector y validación). Hipster: paso 9. */
const JUGABLES: Record<string, Dinamica> = {
  trivia,
  dos_verdades: dosVerdades,
  aproximaciones,
}

const METAS: Record<string, MetaDinamica> = {
  trivia: trivia.meta,
  dos_verdades: dosVerdades.meta,
  aproximaciones: aproximaciones.meta,
  hipster,
}

export function dinamicaDe(clave: string | undefined): Dinamica | null {
  return (clave && JUGABLES[clave]) || null
}

export function metaDe(clave: string | undefined): MetaDinamica {
  return (
    (clave && METAS[clave]) || {
      clave: clave ?? '',
      nombre: 'Juego',
      comoSeJuega: 'Miren la consigna y respondan desde el celular.',
      instruccionCelular: 'Respondé desde acá.',
      sustantivo: 'ítem',
      tipos: [],
    }
  )
}
