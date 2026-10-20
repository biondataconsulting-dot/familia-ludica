import { Logo } from '../components/Logo'

export default function NoEncontrada() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center">
      <Logo className="w-36 shadow-md" />
      <h1 className="text-2xl font-bold">Esta página no existe</h1>
      <p className="text-profundo/70">Revisá el enlace o escaneá de nuevo el QR del proyector.</p>
    </div>
  )
}
