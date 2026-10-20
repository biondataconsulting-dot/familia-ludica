import type { Live } from '../lib/tipos'

/** Lo que ve la mesa ya registrada, según la fase. Por ahora solo la portada (el resto, paso 5). */
export function EnJuego({ live }: { live: Live }) {
  if (live.phase === 'cover') {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
        <p className="text-6xl" aria-hidden>
          🎲
        </p>
        <h1 className="text-4xl font-bold">¡Listos!</h1>
        <p className="text-lg text-profundo/80">Miren el proyector: la noche arranca en un ratito.</p>
      </div>
    )
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
      <h1 className="text-3xl font-bold">Miren el proyector</h1>
    </div>
  )
}
