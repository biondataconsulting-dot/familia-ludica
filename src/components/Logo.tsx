import { useState } from 'react'

type Props = {
  /** Clases del panel (tamaño, padding, rotación). */
  className?: string
}

/** Logo siempre sobre panel blanco: nunca directo sobre azul ni foto (manual de marca). */
export function Logo({ className = '' }: Props) {
  const [falta, setFalta] = useState(false)

  return (
    <div className={`flex items-center justify-center rounded-carta bg-white shadow-md ${className}`}>
      {falta ? (
        import.meta.env.DEV ? (
          <span className="text-center text-[0.6rem] leading-tight text-profundo/50">
            Falta public/brand/logo.png
          </span>
        ) : null
      ) : (
        <img
          src="/brand/logo.png"
          alt="Familia Lúdica"
          className="h-full w-full object-contain"
          onError={() => setFalta(true)}
        />
      )}
    </div>
  )
}
