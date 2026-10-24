import { codigoCarton, columna, FORMATO, type Carton, type TipoBingo } from './formato'

/** Colores por tipo de bingo: la letra grande y la franja de arriba (para separar los juegos de cartones). */
const COLOR: Record<TipoBingo, string> = { express: '#3FC0F0', full: '#1166AB' }

type Props = {
  tipo: TipoBingo
  numero: number
  filas: Carton
  /** Título (corto si tiene) y artista de cada número del set. */
  canciones: Map<number, { titulo: string; artista: string }>
  nombreSet: string
}

/**
 * Un cartón para imprimir y plastificar: Express en A5 apaisado (3 × 5), Full en A4 apaisado (3 × 9).
 * Cada número va en la columna de su rango, como en un cartón de bingo de verdad; las celdas vacías llevan
 * una trama suave. Medidas en mm (se imprime a tamaño real).
 */
export function CartonImpreso({ tipo, numero, filas, canciones, nombreSet }: Props) {
  const f = FORMATO[tipo]
  const express = tipo === 'express'
  const celdas: ({ n: number } | null)[] = []
  for (const fila of filas) {
    for (let c = 0; c < f.columnas; c++) {
      const n = fila.find((x) => columna(tipo, x) === c)
      celdas.push(n ? { n } : null)
    }
  }
  return (
    <div
      className="carton-bingo flex flex-col bg-white text-profundo"
      style={{
        width: express ? '210mm' : '297mm',
        height: express ? '148mm' : '210mm',
        padding: express ? '6mm 7mm' : '9mm 10mm',
        gap: express ? '3.5mm' : '5mm',
      }}
    >
      <div
        className="flex items-center text-white"
        style={{ background: COLOR[tipo], borderRadius: '4mm', padding: express ? '2.5mm 4mm' : '4mm 6mm', gap: '5mm' }}
      >
        <div className="flex bg-white" style={{ borderRadius: '3mm', padding: '1.5mm 2.5mm' }}>
          <img src="/brand/logo.png" alt="Familia Lúdica" style={{ width: express ? '30mm' : '37mm', height: 'auto' }} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-titulo font-bold leading-none" style={{ fontSize: express ? '9mm' : '14mm' }}>
            BINGO MUSICAL
          </p>
          <p className="font-semibold" style={{ fontSize: express ? '3.4mm' : '4.2mm', marginTop: '1.2mm', opacity: 0.92 }}>
            {f.nombre} · Escuchá la canción, buscala en tu cartón y marcala.
          </p>
        </div>
        <div className="text-right">
          <span
            className="inline-flex items-center font-titulo font-bold leading-none"
            style={{ background: '#EC681B', borderRadius: '3mm', padding: '1.5mm 3.5mm', fontSize: express ? '7mm' : '9mm', gap: '2mm' }}
          >
            <span style={{ fontSize: express ? '9mm' : '11mm' }}>{f.letra}</span>
            {String(numero).padStart(3, '0')}
          </span>
          <span className="block font-bold" style={{ fontSize: '3.2mm', marginTop: '1.2mm', opacity: 0.85 }}>
            {nombreSet}
          </span>
        </div>
      </div>

      <div
        className="grid flex-1 overflow-hidden"
        style={{
          gridTemplateColumns: `repeat(${f.columnas}, 1fr)`,
          gridTemplateRows: 'repeat(3, 1fr)',
          border: '1.2mm solid #173F63',
          borderRadius: '4mm',
        }}
      >
        {celdas.map((x, i) => {
          const borde = {
            borderRight: (i + 1) % f.columnas === 0 ? 'none' : '0.5mm solid rgba(23,63,99,.35)',
            borderBottom: i >= celdas.length - f.columnas ? 'none' : '0.5mm solid rgba(23,63,99,.35)',
          }
          if (!x)
            return (
              <div
                key={i}
                className="flex items-center justify-center"
                style={{
                  ...borde,
                  background: '#FFF8F2',
                  backgroundImage: 'radial-gradient(rgba(17,102,171,.13) .5mm, transparent .6mm)',
                  backgroundSize: '4mm 4mm',
                  color: 'rgba(17,102,171,.28)',
                  fontSize: '11mm',
                }}
              >
                ♪
              </div>
            )
          const cancion = canciones.get(x.n)
          return (
            <div key={i} className="relative flex flex-col items-center justify-center text-center" style={{ ...borde, padding: '2.5mm 2mm 2mm', gap: '1mm' }}>
              <span
                className="absolute flex items-center justify-center font-titulo font-bold text-white"
                style={{ top: '1.5mm', left: '1.5mm', minWidth: '7mm', height: '7mm', padding: '0 1.2mm', borderRadius: '3.5mm', background: '#EC681B', fontSize: '4.2mm' }}
              >
                {x.n}
              </span>
              <span className="font-titulo font-semibold" style={{ fontSize: (cancion?.titulo.length ?? 0) > 26 ? '3.9mm' : '4.6mm', lineHeight: 1.1, marginTop: '3mm' }}>
                {cancion?.titulo ?? '—'}
              </span>
              <span className="font-bold uppercase" style={{ fontSize: '3.1mm', color: 'rgba(23,63,99,.65)', letterSpacing: '.2mm', lineHeight: 1.15 }}>
                {cancion?.artista}
              </span>
            </div>
          )
        })}
      </div>

      <div className="flex items-center font-bold" style={{ fontSize: '3.7mm', gap: '5mm' }}>
        <span className="flex items-center" style={{ gap: '2mm' }}>
          <b className="font-titulo font-semibold text-white" style={{ background: '#173F63', borderRadius: '2mm', padding: '0.8mm 2.5mm' }}>
            LÍNEA
          </b>
          las {f.porFila} canciones de una fila
        </span>
        <span className="flex items-center" style={{ gap: '2mm' }}>
          <b className="font-titulo font-semibold text-white" style={{ background: '#173F63', borderRadius: '2mm', padding: '0.8mm 2.5mm' }}>
            BINGO
          </b>
          las {3 * f.porFila} del cartón
        </span>
        <span className="ml-auto font-semibold" style={{ color: 'rgba(23,63,99,.6)' }}>
          {codigoCarton(tipo, numero)} · @familia.ludica
        </span>
      </div>
    </div>
  )
}
