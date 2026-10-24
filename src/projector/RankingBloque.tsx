import { formatearNumero } from '../dynamics/solucion'
import type { Live } from '../lib/tipos'
import { FilaPuesto } from './FilaPuesto'

/**
 * Fase block_ranking: ranking completo de la noche al cerrar la dinámica (dos columnas desde 9 mesas, tres desde 15).
 * También el botón "Cómo va la noche" del conductor (enCualquierMomento: sin "después de" ni puntos del bloque).
 */
export function RankingBloque({ live, enCualquierMomento = false }: { live: Live; enCualquierMomento?: boolean }) {
  const filas = live.ranking
  // Medido a 16:9 con el logo de la esquina y la franja del desafío abajo (el peor caso): una columna hasta
  // 8 mesas; dos columnas de 7 hasta 14; tres columnas de 7 hasta 21 y de 10 (letra más chica) hasta 30.
  const cantidad = filas.length > 14 ? 3 : filas.length > 8 ? 2 : 1
  const porColumna = Math.ceil(filas.length / cantidad)
  const columnas = Array.from({ length: cantidad }, (_, i) => filas.slice(i * porColumna, (i + 1) * porColumna))
  const tam = filas.length > 21 ? 1.3 : filas.length > 14 ? 1.6 : 2

  return (
    <div className="flex h-full flex-col gap-[1.5cqw] px-[4cqw] pb-[2.5cqw] pt-[3cqw]">
      <div className="libre-logo-derecha">
        <h1 className="font-titulo text-[4.5cqw] font-bold leading-none">Así va la noche</h1>
        {live.block && !enCualquierMomento && <p className="mt-[0.6cqw] text-[1.8cqw] font-semibold text-white/80">Después de {live.block.title}</p>}
      </div>
      {filas.length === 0 ? (
        <p className="text-[2cqw] text-white/80">Todavía no hay mesas en el ranking.</p>
      ) : (
        // Con dos o tres columnas, la de la derecha llega hasta el logo de la esquina: todas bajan lo justo.
        <div
          className={`grid min-h-0 flex-1 content-start gap-x-[3cqw] ${
            cantidad === 3 ? 'debajo-del-logo grid-cols-3' : cantidad === 2 ? 'debajo-del-logo grid-cols-2' : 'mx-auto w-[60cqw] grid-cols-1'
          }`}
        >
          {columnas.map((col, i) => (
            <div key={i} className="flex flex-col gap-[0.5cqw]">
              {col.map((r) => (
                <FilaPuesto
                  key={r.team_id}
                  puesto={r.position}
                  nombre={r.name}
                  total={r.total}
                  extra={r.block_total && !enCualquierMomento ? `+${formatearNumero(r.block_total)} en el bloque` : undefined}
                  tam={tam}
                  penalizacion={r.penalizacion}
                />
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
