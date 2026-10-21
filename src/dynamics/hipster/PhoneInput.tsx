import { useState } from 'react'
import { textoANumero } from '../comun/entrada'
import { SelectorAnio } from '../comun/SelectorAnio'
import type { PropsPhoneInput } from '../tipos'

/** Año (obligatorio) con − / + y teclado; título y artista opcionales, que suman 200 cada uno. */
export function PhoneInput({ item, valor, onCambiar }: PropsPhoneInput) {
  const [anio, setAnio] = useState(() => (typeof valor?.anio === 'number' ? String(valor.anio) : ''))
  const [titulo, setTitulo] = useState(() => (typeof valor?.titulo === 'string' ? valor.titulo : ''))
  const [artista, setArtista] = useState(() => (typeof valor?.artista === 'string' ? valor.artista : ''))
  const esMusica = (item.content.categoria ?? 'musica') === 'musica'
  const esEscena = item.type === 'clip_video'

  const emitir = (a: string, t: string, ar: string) => {
    const n = textoANumero(a)
    onCambiar({
      ...(n != null ? { anio: n } : {}),
      ...(t.trim() ? { titulo: t.trim() } : {}),
      ...(ar.trim() ? { artista: ar.trim() } : {}),
    })
  }

  const campo = 'min-h-toque w-full rounded-carta border-2 border-profundo/15 bg-white px-4 text-lg focus:border-azul focus:outline-none'
  return (
    <div className="flex w-full flex-col gap-4">
      <SelectorAnio
        texto={anio}
        onTexto={(a) => {
          setAnio(a)
          emitir(a, titulo, artista)
        }}
      />
      <label className="block">
        <span className="mb-1 block font-bold">
          {esMusica ? 'Canción' : 'Título'} <span className="font-semibold text-profundo/75">(opcional, +200)</span>
        </span>
        <input
          value={titulo}
          maxLength={100}
          autoComplete="off"
          onChange={(e) => {
            setTitulo(e.target.value)
            emitir(anio, e.target.value, artista)
          }}
          className={campo}
        />
      </label>
      <label className="block">
        <span className="mb-1 block font-bold">
          {esEscena ? 'Director o directora' : esMusica ? 'Artista o banda' : 'Artista'} <span className="font-semibold text-profundo/75">(opcional, +200)</span>
        </span>
        <input
          value={artista}
          maxLength={100}
          autoComplete="off"
          onChange={(e) => {
            setArtista(e.target.value)
            emitir(anio, titulo, e.target.value)
          }}
          className={campo}
        />
      </label>
    </div>
  )
}
