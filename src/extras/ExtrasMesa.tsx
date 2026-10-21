import { formatearNumero } from '../dynamics/solucion'
import type { ExtrasPublicos } from './rpc'

/** Celular: el desafío en curso, arriba y destacado (es lo urgente). */
export function DesafioMesa({ desafio }: { desafio: NonNullable<ExtrasPublicos['desafio']> }) {
  return (
    <section aria-label="Desafío en curso" className="mb-4 rounded-carta bg-naranja px-4 py-3 text-white shadow-md">
      <p className="text-xs font-extrabold uppercase tracking-wide">⚡ Desafío · solo suma la primera mesa</p>
      <p className="font-titulo text-xl font-semibold leading-tight">{desafio.title}</p>
      {desafio.description && <p className="mt-1 text-sm">{desafio.description}</p>}
      <p className="mt-1 font-titulo text-lg font-bold">+{formatearNumero(desafio.points)} puntos</p>
    </section>
  )
}

/** Celular: las misiones abiertas, con tilde en las que esta mesa ya cumplió. */
export function MisionesMesa({ misiones }: { misiones: ExtrasPublicos['misiones'] }) {
  const cumplidas = misiones.filter((m) => m.cumplida).length
  return (
    <section aria-label="Misiones secretas" className="mt-6 rounded-carta bg-white p-4 shadow-md">
      <h2 className="font-titulo text-lg font-semibold">
        🕵️ Misiones secretas <span className="text-sm font-bold text-profundo/75">· {cumplidas} de {misiones.length}</span>
      </h2>
      <p className="mb-2 text-sm text-profundo/75">Cuando cumplan una, avísenle al presentador.</p>
      <ul className="flex flex-col gap-2">
        {misiones.map((m) => (
          <li key={m.id} className={`flex items-start gap-3 rounded-xl px-3 py-2 ${m.cumplida ? 'bg-green-100' : 'bg-crema'}`}>
            <span className={`mt-0.5 text-lg leading-none ${m.cumplida ? 'text-green-700' : 'text-profundo/40'}`} aria-hidden>
              {m.cumplida ? '✔' : '○'}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-bold">{m.title}</span>
              {m.description && <span className="block text-sm text-profundo/75">{m.description}</span>}
            </span>
            <span className="shrink-0 font-titulo font-semibold">
              {m.cumplida ? <span className="text-green-700">¡Hecha!</span> : `+${formatearNumero(m.points)}`}
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}
