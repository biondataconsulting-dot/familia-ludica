import type { PropsPhoneInput } from '../tipos'

/** Un campo de texto: lo que creen que va a responder la mayoría. */
export function PhoneInput({ valor, onCambiar }: PropsPhoneInput) {
  const texto = typeof valor?.texto === 'string' ? valor.texto : ''
  return (
    <label className="block w-full">
      <span className="mb-1 block font-bold">Lo que va a responder la mayoría</span>
      <input
        value={texto}
        maxLength={60}
        autoComplete="off"
        enterKeyHint="done"
        onChange={(e) => onCambiar(e.target.value ? { texto: e.target.value } : {})}
        className="min-h-toque w-full rounded-carta border-2 border-profundo/15 bg-white px-4 text-lg focus:border-azul focus:outline-none"
      />
      <span className="mt-1 block text-sm text-profundo/75">Una palabra o dos alcanzan: tiene que coincidir con lo que escriban las otras mesas.</span>
    </label>
  )
}
