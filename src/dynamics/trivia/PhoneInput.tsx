import { BotonesOpcion } from '../opciones/BotonesOpcion'
import { opcionesDe } from '../opciones/validate'
import { letraOpcion } from '../solucion'
import type { PropsPhoneInput } from '../tipos'

/** A, B, C, D con los mismos colores que el proyector. */
export function PhoneInput({ item, valor, onCambiar }: PropsPhoneInput) {
  const opciones = opcionesDe(item, 'opciones')
  return (
    <BotonesOpcion
      etiquetas={opciones.map((_, i) => letraOpcion(i))}
      textos={opciones}
      elegida={typeof valor?.opcion === 'number' ? valor.opcion : null}
      onElegir={(i) => onCambiar({ opcion: i })}
    />
  )
}
