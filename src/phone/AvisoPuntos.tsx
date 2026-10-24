import { useEffect, useState } from 'react'
import { formatearNumero } from '../dynamics/solucion'
import type { Live } from '../lib/tipos'

const DURA_MS = 10000

/** Cartel de 10 s en todos los celulares cuando el conductor carga puntos a mano o una mesa gana un desafío. */
export function AvisoPuntos({ aviso, desfaseMs }: { aviso: Live['aviso']; desfaseMs: number }) {
  const [, refrescar] = useState(0)
  const restante = aviso ? DURA_MS - (Date.now() + desfaseMs - Date.parse(aviso.at)) : 0

  // Se vuelve a dibujar cuando se cumple el tiempo, para irse solo.
  useEffect(() => {
    if (restante <= 0) return
    const id = window.setTimeout(() => refrescar((n) => n + 1), restante + 50)
    return () => window.clearTimeout(id)
  }, [aviso?.id, restante])

  if (!aviso || restante <= 0) return null
  const desafio = aviso.reason.startsWith('Desafío: ')
  const signo = aviso.points > 0 ? '+' : '−'
  const penalizacion = aviso.points < 0
  return (
    <div role="status" className="fixed inset-x-0 top-16 z-50 mx-auto max-w-md px-4">
      <div className={`rounded-carta px-4 py-3 text-white shadow-2xl ${penalizacion ? 'bg-red-700' : 'bg-profundo'}`}>
        {penalizacion ? (
          <p className="font-titulo text-lg font-semibold leading-tight">
            ⚠ Penalización para {aviso.team}:{' '}
            <span className="whitespace-nowrap font-bold">−{formatearNumero(Math.abs(aviso.points))}</span>
            <span className="block text-base font-normal">{aviso.reason}</span>
          </p>
        ) : desafio ? (
          <p className="font-titulo text-lg font-semibold leading-tight">
            🏆 {aviso.team} ganó el desafío: {aviso.reason.slice('Desafío: '.length)}{' '}
            <span className="whitespace-nowrap font-bold">+{formatearNumero(aviso.points)}</span>
          </p>
        ) : (
          <p className="font-titulo text-lg font-semibold leading-tight">
            <span className="whitespace-nowrap font-bold">
              {signo}
              {formatearNumero(Math.abs(aviso.points))}
            </span>{' '}
            para {aviso.team} · <span className="font-normal">{aviso.reason}</span>
          </p>
        )}
      </div>
    </div>
  )
}
