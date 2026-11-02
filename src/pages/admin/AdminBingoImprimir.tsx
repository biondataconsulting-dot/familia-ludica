import { useEffect, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { Mensaje } from '../../admin/ui'
import { CartonImpreso } from '../../bingo/CartonImpreso'
import { FORMATO, paraReimprimir, type TipoBingo } from '../../bingo/formato'
import { bingoAdmin, type CancionSet, type CartonGuardado, type SetBingo } from '../../bingo/rpc'
import { ErrorRpc } from '../../lib/rpc'

/**
 * Corte de la hoja A4 (en mm desde arriba): una línea arriba, una al medio y una abajo, así los dos cartones quedan
 * de la misma altura (143 mm) y las líneas de los bordes caen dentro de lo que imprime cualquier impresora.
 */
const CORTES = [5.5, 148.5, 291.5]
const ALTO = 143
/** El cartón Express mide 210 × 148 mm; el Full, 297 × 210 (A4 → A5 es la misma proporción: 70,7 %). */
const ZOOM = { express: ALTO / 148, full: (0.7071 * ALTO) / 148 }

/**
 * /admin/bingo/:setId/imprimir/:tipo — todos los cartones de un tipo, dos por hoja A4 vertical, con líneas de corte
 * arriba, al medio y abajo.
 * Imprimir con Ctrl+P (o «Guardar como PDF»), escala 100 %, sin márgenes.
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
  const hojas = Array.from({ length: Math.ceil(cartones.length / 2) }, (_, i) => cartones.slice(i * 2, i * 2 + 2))

  return (
    <div>
      {/* Hoja A4 vertical sin márgenes. Los colores de fondo (franja,
          números, celdas vacías) se imprimen aunque «gráficos de fondo» esté apagado. */}
      <style>{`@page { size: A4 portrait; margin: 0; }
        .hoja-bingo, .hoja-bingo * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        @media print { body { background: #fff !important; } .hoja-bingo { break-after: page; } }`}</style>
      <div className="mb-4 flex flex-wrap items-center gap-3 rounded-carta bg-white p-4 shadow-md print:hidden">
        <p className="min-w-0 flex-1 text-sm">
          <b>
            {cartones.length} {cartones.length === 1 ? 'cartón' : 'cartones'} {f.nombre}
            {soloCambiados && ' para reimprimir'}
          </b>{' '}
          del set «{datos.set.name}», dos por hoja A4 (se cortan por las líneas punteadas). En la ventana de impresión: tamaño A4,
          orientación vertical, escala 100 % y márgenes «ninguno».
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
        {hojas.map((hoja) => (
          <div key={hoja[0]!.numero} className="hoja-bingo relative overflow-hidden bg-white shadow-lg print:shadow-none" style={{ width: '210mm', height: '297mm' }}>
            {hoja.map((c, i) => (
              <div key={c.numero} className="absolute inset-x-0 flex justify-center overflow-hidden" style={{ top: `${CORTES[i]}mm`, height: `${ALTO}mm` }}>
                <div style={{ zoom: ZOOM[tipo] }}>
                  <CartonImpreso tipo={tipo} numero={c.numero} filas={c.filas} canciones={canciones} nombreSet={datos.set.name} />
                </div>
              </div>
            ))}
            {CORTES.slice(0, hoja.length + 1).map((y) => (
              // Sobre el margen blanco de los cartones.
              <div key={y} className="absolute inset-x-0" style={{ top: `${y}mm`, borderTop: '0.3mm dashed rgba(23,63,99,.45)' }} />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
