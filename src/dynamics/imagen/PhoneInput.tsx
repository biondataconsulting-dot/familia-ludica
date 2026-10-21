import type { PropsPhoneInput } from '../tipos'

/** Un campo de texto para la respuesta. */
export function PhoneInput({ valor, onCambiar }: PropsPhoneInput) {
  const texto = typeof valor?.respuesta === 'string' ? valor.respuesta : ''
  return (
    <label className="block w-full">
      <span className="mb-1 block font-bold">Su respuesta</span>
      <input
        value={texto}
        maxLength={100}
        autoComplete="off"
        enterKeyHint="done"
        onChange={(e) => onCambiar(e.target.value ? { respuesta: e.target.value } : {})}
        className="min-h-toque w-full rounded-carta border-2 border-profundo/15 bg-white px-4 text-lg focus:border-azul focus:outline-none"
      />
    </label>
  )
}
