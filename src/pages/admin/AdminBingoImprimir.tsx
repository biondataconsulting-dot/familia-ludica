import { useEffect, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { Mensaje } from '../../admin/ui'
import { CartonImpreso } from '../../bingo/CartonImpreso'
import { FORMATO, paraReimprimir, type TipoBingo } from '../../bingo/formato'
import { bingoAdmin, type CancionSet, type CartonGuardado, type SetBingo } from '../../bingo/rpc'
import { ErrorRpc } from '../../lib/rpc'

/**
 * /admin/bingo/:setId/imprimir/:tipo — todos los cartones de un tipo, uno por hoja (Express A5 apaisado,
 * Full A4 apaisado). Imprimir con Ctrl+P (o «Guardar como PDF»), escala 100 %, sin márgenes.
 * Con `?solo=cambiados`, solo los que tienen canciones cambiadas después de imprimir.
 */
export default function AdminBingoImprimir() {
  const { setId = '', tipo: tipoUrl } = useParams()
  const tipo: TipoBingo = tipoUrl === 'express' ? 'express' : 'full'
  const [datos, setDatos] = useState<{ set: SetBingo; canciones: CancionSet[]; cartones: CartonGuardado[] } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const soloCambiados = useSearchParams()[0].get('solo') === 'cambiados'
  const [listo, setListo] = useState(false)

  useEffect(() => {
    bingoAdmin.set(setId).then(setDatos, (e) => setError(e instanceof ErrorRpc ? e.message : 'No se pudo leer el set.'))
  }, [setId])

  if (error) return <Mensaje>{error}</Mensaje>
  if (!datos) return <p className="text-profundo/70">Preparando los cartones…</p>

  const canciones = new Map(datos.canciones.map((c) => [c.number, { titulo: c.titulo_carton || c.titulo, artista: c.artista }]))
  const cambiados = new Set(paraReimprimir(tipo, datos.canciones, datos.cartones, datos.set.impresos[tipo]).cartones)
  const cartones = datos.cartones.filter((c) => c.tipo === tipo && (!soloCambiados || cambiados.has(c.numero)))
  const f = FORMATO[tipo]

  return (
    <div>
      {/* Tamaño de hoja del tipo, sin márgenes (cada cartón ocupa la hoja entera). */}
      <style>{`@page { size: ${tipo === 'express' ? 'A5' : 'A4'} landscape; margin: 0; }
        @media print { body { background: #fff !important; } .carton-bingo { break-after: page; } }`}</style>
      <div className="mb-4 flex flex-wrap items-center gap-3 rounded-carta bg-white p-4 shadow-md print:hidden">
        <p className="min-w-0 flex-1 text-sm">
          <b>
            {cartones.length} cartones {f.nombre}
            {soloCambiados && ' para reimprimir'}
          </b>{' '}
          del set «{datos.set.name}», uno por hoja {tipo === 'express' ? 'A5' : 'A4'} apaisada. En la ventana de impresión: tamaño{' '}
          {tipo === 'express' ? 'A5' : 'A4'}, orientación horizontal, escala 100 %, márgenes «ninguno» y «gráficos de fondo» activado.
        </p>
        <button onClick={() => window.print()} className="min-h-toque rounded-xl bg-naranja px-4 font-titulo font-semibold text-white">
          Imprimir
        </button>
        {cambiados.size > 0 && cartones.length > 0 && (
          <button
            disabled={listo}
            onClick={() =>
              bingoAdmin.reimpresos(setId, tipo).then(
                () => setListo(true),
                (e) => setError(e instanceof ErrorRpc ? e.message : 'No se pudo guardar.'),
              )
            }
            className="min-h-toque rounded-xl border-2 border-profundo/20 px-4 font-semibold disabled:opacity-60"
          >
            {listo ? 'Listo ✓' : 'Ya los reimprimí'}
          </button>
        )}
      </div>
      <div className="flex flex-col items-center gap-6 print:block print:gap-0">
        {cartones.map((c) => (
          <div key={c.numero} className="shadow-lg print:shadow-none">
            <CartonImpreso tipo={tipo} numero={c.numero} filas={c.filas} canciones={canciones} nombreSet={datos.set.name} />
          </div>
        ))}
      </div>
    </div>
  )
}
