import { useParams } from 'react-router-dom'
import { Logo } from '../components/Logo'
import { ProjectorLayout } from '../layouts/ProjectorLayout'

/** Proyector. Por ahora, maqueta de la portada (paso 1); los datos reales llegan en el paso 4. */
export default function Pantalla() {
  const { codigo = '' } = useParams()

  return (
    <ProjectorLayout logoEsquina={false}>
      <div className="flex h-full items-center gap-[5cqw] px-[6cqw]">
        <div className="flex-1">
          <h1 className="font-titulo text-[6cqw] font-bold leading-[1.05] text-amarillo">
            Noche de Juegos
          </h1>
          <p className="mt-[1.5cqw] text-[2cqw] text-white/85">Muy pronto, la portada de la noche.</p>
        </div>

        <div className="flex w-[30cqw] rotate-[3deg] flex-col items-center gap-[1.4cqw] rounded-[2cqw] bg-crema p-[2.5cqw] text-profundo shadow-2xl">
          {/* La tarjeta va inclinada pero el logo no se rota: se compensa el giro. */}
          <Logo className="w-[11cqw] -rotate-[3deg]" />
          <div className="flex aspect-square w-[18cqw] items-center justify-center rounded-[1.2cqw] border-[0.25cqw] border-dashed border-profundo/25 text-[1.2cqw] text-profundo/50">
            QR
          </div>
          <p className="font-titulo text-[4cqw] font-bold leading-none tracking-[0.15em]">{codigo.toUpperCase()}</p>
          <p className="text-center text-[1.5cqw] font-semibold">Escaneá con un celular por mesa</p>
        </div>
      </div>
    </ProjectorLayout>
  )
}
