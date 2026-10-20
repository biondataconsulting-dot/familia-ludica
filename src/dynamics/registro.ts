import { meta as aproximaciones } from './aproximaciones/meta'
import { meta as dosVerdades } from './dos_verdades/meta'
import { meta as hipster } from './hipster/meta'
import type { MetaDinamica } from './tipos'
import { meta as trivia } from './trivia/meta'

const DINAMICAS: Record<string, MetaDinamica> = {
  trivia,
  dos_verdades: dosVerdades,
  aproximaciones,
  hipster,
}

export function metaDe(clave: string | undefined): MetaDinamica {
  return (
    (clave && DINAMICAS[clave]) || {
      clave: clave ?? '',
      nombre: 'Juego',
      comoSeJuega: 'Miren la consigna y respondan desde el celular.',
      instruccionCelular: 'Respondé desde acá.',
      sustantivo: 'ítem',
      tipos: [],
    }
  )
}
