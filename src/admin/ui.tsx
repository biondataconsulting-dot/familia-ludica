import type { ReactNode } from 'react'

/** Piezas chicas compartidas por las pantallas de preparación del panel. */

export const CAMPO =
  'min-h-toque w-full rounded-xl border-2 border-profundo/15 bg-white px-3 focus:border-azul focus:outline-none disabled:bg-crema'

export function Tarjeta({ titulo, acciones, children }: { titulo?: ReactNode; acciones?: ReactNode; children: ReactNode }) {
  return (
    <section className="rounded-carta bg-white p-5 shadow-md">
      {(titulo || acciones) && (
        <div className="mb-3 flex flex-wrap items-center gap-2">
          {titulo && <h2 className="text-lg font-bold">{titulo}</h2>}
          {acciones && <div className="ml-auto flex flex-wrap gap-2">{acciones}</div>}
        </div>
      )}
      {children}
    </section>
  )
}

export function Etiqueta({ texto, ayuda, children }: { texto: string; ayuda?: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-sm font-bold">
        {texto} {ayuda && <span className="font-semibold text-profundo/50">{ayuda}</span>}
      </span>
      {children}
    </label>
  )
}

export function BotonPrincipal({ children, ...p }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button {...p} className={`min-h-toque rounded-xl bg-naranja px-4 font-titulo font-semibold text-white shadow-sm disabled:opacity-50 ${p.className ?? ''}`}>
      {children}
    </button>
  )
}

export function BotonSecundario({ children, ...p }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...p}
      className={`min-h-toque rounded-xl border-2 border-profundo/15 px-3 font-semibold hover:bg-crema disabled:opacity-40 ${p.className ?? ''}`}
    >
      {children}
    </button>
  )
}

export function Mensaje({ tipo = 'error', children }: { tipo?: 'error' | 'ok'; children: ReactNode }) {
  return (
    <p role={tipo === 'error' ? 'alert' : 'status'} className={`rounded-xl px-4 py-2 text-sm font-semibold ${tipo === 'error' ? 'bg-naranja/15' : 'bg-green-100 text-green-800'}`}>
      {children}
    </p>
  )
}
