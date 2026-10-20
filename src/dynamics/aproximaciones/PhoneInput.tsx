import { useState } from 'react'
import { ENTRADA_NUMERO, numeroATexto, textoANumero } from '../comun/entrada'
import { SelectorAnio } from '../comun/SelectorAnio'
import { TecladoNumerico } from '../comun/TecladoNumerico'
import type { PropsPhoneInput } from '../tipos'

/** Teclado numérico grande; si la pregunta pide un año, selector de año. */
export function PhoneInput({ item, valor, onCambiar }: PropsPhoneInput) {
  const [texto, setTexto] = useState(() => (typeof valor?.valor === 'number' ? numeroATexto(valor.valor) : ''))
  const unidad = typeof item.content.unidad === 'string' ? item.content.unidad : ''

  const cambiar = (t: string) => {
    setTexto(t)
    const n = textoANumero(t)
    onCambiar(n == null ? {} : { valor: n })
  }

  return item.content.formato === 'anio' ? (
    <SelectorAnio texto={texto} onTexto={cambiar} />
  ) : (
    <TecladoNumerico texto={texto} onTexto={cambiar} opciones={ENTRADA_NUMERO} unidad={unidad} />
  )
}
