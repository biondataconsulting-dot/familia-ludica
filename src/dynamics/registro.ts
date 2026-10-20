import { aproximaciones } from './aproximaciones'
import { cine } from './cine'
import { dosVerdades } from './dos_verdades'
import { hipster } from './hipster'
import type { Dinamica, MetaDinamica } from './tipos'
import { trivia } from './trivia'

/** Dinámicas jugables (con formulario, proyector y validación). */
const JUGABLES: Record<string, Dinamica> = {
  trivia,
  dos_verdades: dosVerdades,
  aproximaciones,
  hipster,
  cine,
}

const METAS: Record<string, MetaDinamica> = Object.fromEntries(Object.entries(JUGABLES).map(([k, d]) => [k, d.meta]))

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
