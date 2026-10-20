import type { ReactNode } from 'react'

export function Aviso({ children }: { children: ReactNode }) {
  return (
    <p role="alert" className="w-full rounded-xl bg-naranja/10 px-4 py-3 text-left text-sm font-semibold text-profundo">
      {children}
    </p>
  )
}
