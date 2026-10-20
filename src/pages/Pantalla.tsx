import { useParams } from 'react-router-dom'
import { ProjectorLayout } from '../layouts/ProjectorLayout'
import { useLive } from '../live/useLive'
import { Portada } from '../projector/Portada'

/** Proyector: la pantalla protagonista. Muestra lo que corresponde a la fase actual. */
export default function Pantalla() {
  const { codigo = '' } = useParams()
  const { live, error } = useLive(codigo)

  if (!live) {
    return (
      <ProjectorLayout>
        <div className="flex h-full flex-col items-center justify-center gap-[1.5cqw] px-[8cqw] text-center">
          {error ? (
            <>
              <h1 className="font-titulo text-[4cqw] font-bold text-amarillo">
                {error.codigo === 'P0002' ? 'No encontramos esta noche' : 'No podemos conectarnos'}
              </h1>
              <p className="text-[2cqw] text-white/90">{error.message}</p>
              <p className="text-[1.5cqw] text-white/60">Seguimos intentando solos.</p>
            </>
          ) : (
            <p className="font-titulo text-[3cqw] font-semibold text-white/80">Preparando la noche…</p>
          )}
        </div>
      </ProjectorLayout>
    )
  }

  if (live.phase === 'cover') {
    return (
      <ProjectorLayout logoEsquina={false}>
        <Portada live={live} />
      </ProjectorLayout>
    )
  }

  // El resto de las fases llega en el paso 5.
  return (
    <ProjectorLayout>
      <div className="flex h-full items-center justify-center">
        <p className="font-titulo text-[3cqw] font-semibold text-white/80">{live.block?.title ?? 'Miren al conductor'}</p>
      </div>
    </ProjectorLayout>
  )
}
