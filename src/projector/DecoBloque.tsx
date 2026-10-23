/** Emoji decorativo del bloque (por ejemplo 🎃 en Halloween), como un sticker en la esquina de la tarjeta. */
export function DecoBloque({ emoji }: { emoji?: string | null }) {
  if (!emoji) return null
  return (
    <span className="pointer-events-none absolute -right-[1.2cqw] -top-[0.4cqw] rotate-12 select-none text-[5cqw] leading-none drop-shadow-lg" aria-hidden>
      {emoji}
    </span>
  )
}
