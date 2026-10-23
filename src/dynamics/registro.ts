import { aproximaciones } from './aproximaciones'
import { cine } from './cine'
import { dosVerdades } from './dos_verdades'
import { hipster } from './hipster'
import { imagen } from './imagen'
import { oveja } from './oveja'
import type { Dinamica, MetaDinamica } from './tipos'
import { trivia } from './trivia'

/** Dinámicas jugables (con formulario, proyector y validación). */
const JUGABLES: Record<string, Dinamica> = {
  trivia,
  dos_verdades: dosVerdades,
  aproximaciones,
  hipster,
  cine,
  imagen,
  oveja,
}

/** Bloque especial (pausa, sorteo, encuesta…): no es un juego, no tiene ítems. */
const ESPECIAL: MetaDinamica = {
  clave: 'especial',
  nombre: 'Momento especial',
  comoSeJuega: '',
  instruccionCelular: 'Miren el proyector.',
  sustantivo: 'momento',
  tipos: [],
}

const METAS: Record<string, MetaDinamica> = {
  ...Object.fromEntries(Object.entries(JUGABLES).map(([k, d]) => [k, d.meta])),
  especial: ESPECIAL,
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
