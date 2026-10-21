import { CodigoQr } from '../components/CodigoQr'

/** Botón "Mostrar QR": el QR para volver a entrar, en la esquina del logo (el juego sigue a la vista). */
export function QrEsquina({ codigo }: { codigo: string }) {
  return (
    <div className="absolute right-[1.5cqw] top-[1.5cqw] z-30 flex w-[15cqw] flex-col items-center gap-[0.5cqw] rounded-[1.2cqw] bg-crema p-[0.9cqw] text-center text-profundo shadow-2xl">
      <CodigoQr texto={`${window.location.origin}/jugar/${codigo}`} className="w-full" />
      <p className="font-titulo text-[1.9cqw] font-bold leading-none tracking-[0.1em]">{codigo}</p>
      <p className="text-[1.05cqw] font-bold leading-tight">¿Se cerró el celu? Escaneá y tocá «Ya estamos jugando»</p>
    </div>
  )
}
