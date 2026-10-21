/** Lo que se muestra del ítem: los emojis en grande o la imagen (logo, ¿Qué ves?). */
export function Visual({ contenido, chico = false }: { contenido: Record<string, unknown>; chico?: boolean }) {
  if (contenido.estilo === 'emojis') {
    return (
      <p className={`text-center leading-tight tracking-[0.08em] ${chico ? 'text-[5cqw]' : 'text-[9cqw]'}`} aria-label="Emojis">
        {String(contenido.emojis ?? '')}
      </p>
    )
  }
  return (
    <img
      src={String(contenido.imagen ?? '')}
      alt=""
      draggable={false}
      className={`mx-auto w-auto max-w-full rounded-[1cqw] bg-white object-contain ${chico ? 'h-[15cqw]' : 'h-[26cqw]'}`}
    />
  )
}
