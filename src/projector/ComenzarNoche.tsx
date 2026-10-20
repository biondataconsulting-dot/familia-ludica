import { Logo } from '../components/Logo'

/**
 * Primera pantalla del proyector: un toque que habilita el sonido del navegador y pide pantalla completa
 * (las dos cosas solo se pueden pedir con un gesto del usuario; si fallan, la noche sigue igual).
 */
export function ComenzarNoche({ nombre, onComenzar }: { nombre?: string; onComenzar: () => void }) {
  // Nada se espera: si el navegador demora o niega algo, la noche arranca igual.
  function comenzar() {
    onComenzar()
    // Pantalla completa: opcional.
    document.documentElement.requestFullscreen?.().catch(() => {
      /* el navegador puede negarla: no pasa nada */
    })
    // Sonido: un sonido mudo dentro del gesto deja "activado" el audio de la página (también el de YouTube).
    try {
      const Contexto = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      if (Contexto) {
        const ctx = new Contexto()
        const fuente = ctx.createBufferSource()
        fuente.buffer = ctx.createBuffer(1, 1, 22050)
        fuente.connect(ctx.destination)
        fuente.start(0)
        void ctx.resume().catch(() => undefined)
      }
    } catch {
      /* sin audio habilitado: el proyector igual ofrece "Tocá para activar el sonido" si hace falta */
    }
  }

  return (
    <div className="fondo-puntos absolute inset-0 z-40 flex flex-col items-center justify-center gap-[2.5cqw] text-center">
      <Logo className="w-[max(140px,12cqw)]" />
      {nombre && <h1 className="max-w-[70cqw] font-titulo text-[4.5cqw] font-bold leading-tight">{nombre}</h1>}
      <button
        onClick={comenzar}
        className="rounded-full bg-naranja px-[4cqw] py-[1.5cqw] font-titulo text-[3cqw] font-bold text-white shadow-2xl transition hover:brightness-110 active:scale-95"
        autoFocus
      >
        Comenzar la noche
      </button>
      <p className="max-w-[60cqw] text-[1.5cqw] text-white/75">Habilita el sonido y pone el proyector en pantalla completa.</p>
    </div>
  )
}
