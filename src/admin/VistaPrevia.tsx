import { useState } from 'react'
import { dinamicaDe } from '../dynamics/registro'
import { consigna } from '../dynamics/solucion'
import type { ItemActual } from '../lib/tipos'

const DINAMICA_DE_TIPO: Record<string, string> = {
  pregunta_opciones: 'trivia',
  trio_verdad_mentira: 'dos_verdades',
  pregunta_numerica: 'aproximaciones',
  pista_audio: 'hipster',
  clip_video: 'cine',
}

/** Cómo se va a ver el ítem en el proyector (abierto o revelado), en chico. */
export function VistaPrevia({ tipo, contenido, solucion }: { tipo: string; contenido: Record<string, unknown>; solucion: Record<string, unknown> }) {
  const [revelado, setRevelado] = useState(false)
  const d = dinamicaDe(DINAMICA_DE_TIPO[tipo])
  const item: ItemActual = { block_item_id: 'vista-previa', position: 1, number: 1, type: tipo, content: contenido }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2 text-sm">
        <span className="font-bold">Vista previa del proyector:</span>
        <button onClick={() => setRevelado(false)} className={`rounded-lg px-2 ${!revelado ? 'bg-azul text-white' : 'underline'}`}>
          abierto
        </button>
        <button onClick={() => setRevelado(true)} className={`rounded-lg px-2 ${revelado ? 'bg-azul text-white' : 'underline'}`}>
          revelado
        </button>
      </div>
      {/* Escenario 16:9 propio: adentro, cqw es el ancho de esta caja (igual que en el proyector). */}
      <div className="fondo-puntos w-full overflow-hidden rounded-xl" style={{ containerType: 'inline-size', aspectRatio: '16 / 9' }}>
        <div className="flex h-full p-[3cqw]">
          <div className="flex flex-1 flex-col justify-center rounded-[2cqw] bg-crema p-[3cqw] text-profundo shadow-2xl">
            {d ? (
              revelado ? (
                <d.ProjectorReveal item={item} solucion={solucion} puntos={[]} />
              ) : (
                <d.ProjectorOpen item={item} />
              )
            ) : (
              <p className="font-titulo text-[4cqw]">{consigna(tipo, contenido)}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

/** Escuchar el fragmento tal cual va a sonar (YouTube embebido, de inicio a inicio + duración). */
export function PruebaFragmento({ youtubeId, inicio, duracion }: { youtubeId: string; inicio: number; duracion: number }) {
  const [abierto, setAbierto] = useState(false)
  if (!/^[A-Za-z0-9_-]{11}$/.test(youtubeId)) return null
  return abierto ? (
    <div className="flex flex-col gap-2">
      <iframe
        title="Prueba del fragmento"
        className="aspect-video w-full max-w-md rounded-xl"
        src={`https://www.youtube.com/embed/${youtubeId}?start=${inicio}&end=${inicio + duracion}&autoplay=1&rel=0`}
        allow="autoplay; encrypted-media"
      />
      <p className="text-xs text-profundo/60">
        Si dice que el video no está disponible para insertarse, no va a sonar en el proyector: elegí otro.
      </p>
      <button onClick={() => setAbierto(false)} className="self-start text-sm font-semibold text-azul underline">
        Cerrar la prueba
      </button>
    </div>
  ) : (
    <button onClick={() => setAbierto(true)} className="self-start rounded-xl bg-naranja px-4 py-2 font-semibold text-white">
      ▶ Probar el fragmento
    </button>
  )
}
