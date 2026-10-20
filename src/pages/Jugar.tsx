import { useParams } from 'react-router-dom'
import { Logo } from '../components/Logo'
import { PhoneLayout } from '../layouts/PhoneLayout'

/** Celular de mesa. Por ahora, maqueta del registro (paso 1); funciona en el paso 4. */
export default function Jugar() {
  const { codigo = '' } = useParams()

  return (
    <PhoneLayout>
      <div className="flex flex-1 flex-col items-center gap-6 text-center">
        <Logo className="h-28 w-48 p-3" />
        <div>
          <h1 className="text-2xl font-bold">Noche de Juegos</h1>
          <p className="mt-1 text-profundo/70">Código {codigo.toUpperCase()}</p>
        </div>
        <label className="w-full text-left">
          <span className="mb-2 block font-bold">¿Cómo se llama tu mesa?</span>
          <input
            disabled
            placeholder="Ej.: Los Dados Locos"
            className="min-h-toque w-full rounded-carta border-2 border-profundo/15 bg-white px-4 text-lg"
          />
        </label>
        <button disabled className="boton-principal w-full">
          Entrar a jugar
        </button>
        <p className="text-sm text-profundo/60">El registro de mesas todavía no está habilitado.</p>
      </div>
    </PhoneLayout>
  )
}
