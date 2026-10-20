import { formatearNumero } from '../dynamics/solucion'
import type { Live } from '../lib/tipos'
import { FilaPuesto } from './FilaPuesto'

/** Fase block_ranking: ranking completo de la noche al cerrar la dinámica (dos columnas si hay más de 10). */
export function RankingBloque({ live }: { live: Live }) {
  const filas = live.ranking
  const dosColumnas = filas.length > 10
  const mitad = Math.ceil(filas.length / 2)
  const columnas = dosColumnas ? [filas.slice(0, mitad), filas.slice(mitad)] : [filas]
  const tam = filas.length > 20 ? 1.35 : filas.length > 10 ? 1.6 : 2

  return (
    <div className="flex h-full flex-col gap-[1.5cqw] px-[4cqw] pb-[2.5cqw] pt-[3cqw]">
      <div className="libre-logo-derecha">
        <h1 className="font-titulo text-[4.5cqw] font-bold leading-none">Así va la noche</h1>
        {live.block && <p className="mt-[0.6cqw] text-[1.8cqw] font-semibold text-white/80">Después de {live.block.title}</p>}
      </div>
      {filas.length === 0 ? (
        <p className="text-[2cqw] text-white/80">Todavía no hay mesas en el ranking.</p>
      ) : (
        <div className={`grid min-h-0 flex-1 content-start gap-x-[3cqw] ${dosColumnas ? 'grid-cols-2' : 'mx-auto w-[60cqw] grid-cols-1'}`}>
          {columnas.map((col, i) => (
            <div key={i} className="flex flex-col gap-[0.5cqw]">
              {col.map((r) => (
                <FilaPuesto
                  key={r.team_id}
                  puesto={r.position}
                  nombre={r.name}
                  total={r.total}
                  extra={r.block_total ? `+${formatearNumero(r.block_total)} en el bloque` : undefined}
                  tam={tam}
                />
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
