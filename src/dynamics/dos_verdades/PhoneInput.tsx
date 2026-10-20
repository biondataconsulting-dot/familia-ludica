import { BotonesOpcion } from '../opciones/BotonesOpcion'
import { opcionesDe } from '../opciones/validate'
import type { PropsPhoneInput } from '../tipos'

/** "1", "2", "3" con la afirmación resumida (la completa está en el proyector). */
export function PhoneInput({ item, valor, onCambiar }: PropsPhoneInput) {
  const afirmaciones = opcionesDe(item, 'afirmaciones')
  return (
    <BotonesOpcion
      etiquetas={afirmaciones.map((_, i) => String(i + 1))}
      textos={afirmaciones}
      elegida={typeof valor?.opcion === 'number' ? valor.opcion : null}
      onElegir={(i) => onCambiar({ opcion: i })}
      colores={false}
    />
  )
}
