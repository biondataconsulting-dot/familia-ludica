import type { PropsProyector } from '../tipos'

/** El año enorme en naranja, el título y quién la dirigió. */
export function ProjectorReveal({ solucion = {} }: PropsProyector) {
  return (
    <div className="flex flex-col items-center gap-[1cqw] text-center">
      <p className="font-titulo text-[12cqw] font-bold leading-none text-naranja">{String(solucion.anio ?? '')}</p>
      {typeof solucion.titulo === 'string' && <p className="font-titulo text-[4cqw] font-semibold leading-tight">{solucion.titulo}</p>}
      {typeof solucion.artista === 'string' && (
        <p className="text-[2.6cqw] font-bold text-profundo/70">Dirección: {solucion.artista}</p>
      )}
    </div>
  )
}
