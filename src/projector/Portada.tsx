import { CodigoQr } from '../components/CodigoQr'
import { Logo } from '../components/Logo'
import { formatearFecha } from '../lib/fechas'
import type { Live } from '../lib/tipos'

/** Fase cover: título de la noche, QR para entrar y las mesas apareciendo en vivo. */
export function Portada({ live }: { live: Live }) {
  const { event, teams } = live
  const urlJugar = `${window.location.origin}/jugar/${event.code}`
  const fecha = formatearFecha(event.date)

  return (
    <div className="flex h-full flex-col px-[5cqw] pb-[2.5cqw] pt-[4cqw]">
      <div className="flex min-h-0 flex-1 items-center gap-[4cqw]">
        <div className="min-w-0 flex-1">
          {event.settings.edicion && (
            <span className="inline-block -rotate-3 rounded-full bg-naranja px-[1.8cqw] py-[0.5cqw] font-titulo text-[1.8cqw] font-semibold shadow-lg">
              {event.settings.edicion}
            </span>
          )}
          <h1 className="mt-[2cqw] font-titulo text-[5.6cqw] font-bold leading-[1.05] text-white">{event.name}</h1>
          <span className="mt-[1.2cqw] block h-[0.7cqw] w-[12cqw] rounded-full bg-naranja" aria-hidden />
          {(fecha || event.venue) && (
            <p className="mt-[1.5cqw] text-[2.2cqw] font-semibold text-white/90">
              {[fecha, event.venue].filter(Boolean).join(' · ')}
            </p>
          )}
        </div>

        <div className="flex w-[27cqw] shrink-0 rotate-3 flex-col items-center gap-[1cqw] rounded-[2cqw] bg-crema p-[2cqw] text-profundo shadow-2xl">
          {/* La tarjeta va inclinada pero el logo no se rota: se compensa el giro (manual de marca). */}
          <Logo className="w-[9cqw] -rotate-3" />
          <CodigoQr texto={urlJugar} className="w-[19cqw]" />
          {/* Hasta 12 caracteres: la letra se achica con el largo para entrar en la tarjeta. */}
          <p
            className="font-titulo font-bold leading-none tracking-[0.12em]"
            style={{ fontSize: `${Math.min(3.6, 21 / (0.9 * Math.max(event.code.length, 1)))}cqw` }}
          >
            {event.code}
          </p>
          <p className="text-center text-[1.4cqw] font-bold leading-tight">Escaneá con un celular por mesa</p>
        </div>
      </div>

      <MesasListas mesas={teams} />
    </div>
  )
}

function MesasListas({ mesas }: { mesas: Live['teams'] }) {
  const texto =
    mesas.length === 0 ? 'Esperando a las mesas…' : mesas.length === 1 ? '1 mesa lista' : `${mesas.length} mesas listas`

  return (
    <div className="mt-[2cqw] flex min-h-[7cqw] items-start gap-[1.5cqw] rounded-[1.5cqw] bg-profundo/40 px-[1.8cqw] py-[1.2cqw]">
      <p className="shrink-0 pt-[0.2cqw] font-titulo text-[1.9cqw] font-semibold text-celeste">{texto}</p>
      <ul className="flex flex-wrap gap-[0.7cqw]">
        {mesas.map((m) => (
          <li
            key={m.id}
            className={`animate-aparecer rounded-full px-[1.2cqw] py-[0.35cqw] text-[1.35cqw] font-bold ${
              m.connected ? 'bg-white text-profundo' : 'border-[0.15cqw] border-dashed border-white/50 text-white/75'
            }`}
          >
            {m.name}
          </li>
        ))}
      </ul>
    </div>
  )
}
