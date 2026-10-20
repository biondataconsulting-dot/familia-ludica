import { useEffect, useState } from 'react'
import QRCode from 'qrcode'

/** QR generado en el navegador. Ocupa el ancho de su contenedor. */
export function CodigoQr({ texto, className = '' }: { texto: string; className?: string }) {
  const [src, setSrc] = useState<string | null>(null)

  useEffect(() => {
    let activo = true
    QRCode.toDataURL(texto, { errorCorrectionLevel: 'M', margin: 1, width: 720, color: { dark: '#173F63', light: '#FFFFFF' } })
      .then((url) => activo && setSrc(url))
      .catch(() => activo && setSrc(null))
    return () => {
      activo = false
    }
  }, [texto])

  return (
    <div className={`aspect-square overflow-hidden rounded-[1cqw] bg-white ${className}`}>
      {src && <img src={src} alt={`Código QR para entrar: ${texto}`} className="block h-full w-full" />}
    </div>
  )
}
