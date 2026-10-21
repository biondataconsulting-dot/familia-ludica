import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { CAMPO } from './ui'

const MAX_BYTES = 5 * 1024 * 1024
const TIPOS = ['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/svg+xml']

/**
 * Imagen de un ítem: se sube desde la compu a Supabase (bucket "imagenes", nombre al azar para no delatar
 * la respuesta) o se pega un enlace. Muestra cómo queda.
 */
export function SubirImagen({ url, onCambio }: { url: string; onCambio: (url: string) => void }) {
  const [subiendo, setSubiendo] = useState(false)
  const [falla, setFalla] = useState<string | null>(null)

  async function subir(archivo: File | undefined) {
    if (!archivo) return
    setFalla(null)
    if (!TIPOS.includes(archivo.type)) return setFalla('Tiene que ser una imagen PNG, JPG, WEBP, GIF o SVG.')
    if (archivo.size > MAX_BYTES) return setFalla('La imagen pesa más de 5 MB. Achicala y probá de nuevo.')
    setSubiendo(true)
    try {
      const extension = archivo.name.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '') || 'png'
      const ruta = `${crypto.randomUUID()}.${extension}`
      const { error } = await supabase.storage.from('imagenes').upload(ruta, archivo, { contentType: archivo.type, upsert: false })
      if (error) throw error
      onCambio(supabase.storage.from('imagenes').getPublicUrl(ruta).data.publicUrl)
    } catch {
      setFalla('No se pudo subir la imagen. Revisá la conexión y probá de nuevo.')
    } finally {
      setSubiendo(false)
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-bold">Imagen</span>
      <div className="flex flex-wrap items-center gap-3">
        <label className="min-h-toque cursor-pointer rounded-xl bg-azul px-4 py-3 font-semibold text-white">
          {subiendo ? 'Subiendo…' : url ? 'Cambiar imagen' : 'Subir imagen desde la compu'}
          <input type="file" accept={TIPOS.join(',')} className="sr-only" disabled={subiendo} onChange={(e) => void subir(e.target.files?.[0])} />
        </label>
        {url && <img src={url} alt="Imagen del ítem" className="h-20 w-auto rounded-lg border border-profundo/15 bg-white object-contain" />}
      </div>
      <input
        value={url}
        onChange={(e) => onCambio(e.target.value)}
        placeholder="…o pegá un enlace a la imagen"
        aria-label="Enlace de la imagen"
        className={CAMPO}
      />
      {falla && <p className="text-sm font-semibold text-naranja">{falla}</p>}
    </div>
  )
}
