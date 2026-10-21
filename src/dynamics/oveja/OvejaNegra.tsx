/** Dibujo de la oveja negra (solo para reírse: no resta puntos). */
export function DibujoOveja({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 120 100" className={className} role="img" aria-label="Oveja negra">
      {/* patas */}
      <rect x="34" y="68" width="7" height="22" rx="3" fill="#1a1a1a" />
      <rect x="50" y="70" width="7" height="20" rx="3" fill="#1a1a1a" />
      <rect x="68" y="70" width="7" height="20" rx="3" fill="#1a1a1a" />
      <rect x="83" y="68" width="7" height="22" rx="3" fill="#1a1a1a" />
      {/* lana */}
      {[
        [40, 42, 16],
        [58, 34, 18],
        [78, 38, 17],
        [92, 52, 14],
        [74, 60, 16],
        [52, 62, 17],
        [34, 56, 14],
        [62, 50, 18],
      ].map(([cx, cy, r], i) => (
        <circle key={i} cx={cx} cy={cy} r={r} fill="#2b2b2b" />
      ))}
      {/* cabeza */}
      <ellipse cx="22" cy="46" rx="14" ry="17" fill="#111" />
      <ellipse cx="11" cy="34" rx="7" ry="4" fill="#111" transform="rotate(-30 11 34)" />
      <ellipse cx="33" cy="32" rx="7" ry="4" fill="#111" transform="rotate(30 33 32)" />
      {/* ojos y boca */}
      <circle cx="17" cy="44" r="4" fill="#fff" />
      <circle cx="27" cy="44" r="4" fill="#fff" />
      <circle cx="18" cy="45" r="2" fill="#111" />
      <circle cx="28" cy="45" r="2" fill="#111" />
      <path d="M17 54 Q22 58 27 54" stroke="#fff" strokeWidth="2" fill="none" strokeLinecap="round" />
    </svg>
  )
}

/** Tarjeta del proyector: la oveja negra con el nombre de la mesa. */
export function OvejaNegra({ mesa }: { mesa: string }) {
  return (
    <div className="flex items-center gap-[1.4cqw] rounded-[1.2cqw] border-[0.25cqw] border-profundo bg-white px-[1.6cqw] py-[0.6cqw] text-profundo">
      <DibujoOveja className="h-[8.5cqw] w-auto shrink-0" />
      <div className="min-w-0">
        <p className="text-[1.3cqw] font-bold uppercase tracking-wide text-naranja">La oveja negra</p>
        <p className="truncate font-titulo text-[2.6cqw] font-bold leading-tight">{mesa}</p>
        <p className="text-[1.3cqw] text-profundo/75">Todas coincidieron menos ella 😅</p>
      </div>
    </div>
  )
}
