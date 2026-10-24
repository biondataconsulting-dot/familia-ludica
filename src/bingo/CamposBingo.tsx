import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { CAMPO, Etiqueta } from '../admin/ui'
import { FORMATO, type TipoBingo } from './formato'
import { bingoAdmin, type SetBingo } from './rpc'

type Props = { set: string; tipo: TipoBingo; onSet: (id: string) => void; onTipo: (t: TipoBingo) => void }

/** Armar: en un bloque «Bingo musical», qué set de canciones y qué tipo (con qué cartones se juega). */
export function CamposBingo({ set, tipo, onSet, onTipo }: Props) {
  const [sets, setSets] = useState<SetBingo[] | null>(null)
  useEffect(() => {
    bingoAdmin.sets().then(setSets, () => setSets([]))
  }, [])
  return (
    <div className="grid gap-3 rounded-xl bg-crema p-3 md:grid-cols-2">
      <Etiqueta texto="Set de canciones">
        <select value={set} onChange={(e) => onSet(e.target.value)} className={CAMPO}>
          <option value="">— elegir —</option>
          {sets?.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </Etiqueta>
      <Etiqueta texto="Tipo">
        <select value={tipo} onChange={(e) => onTipo(e.target.value as TipoBingo)} className={CAMPO}>
          {(['express', 'full'] as TipoBingo[]).map((t) => (
            <option key={t} value={t}>
              {FORMATO[t].nombre} ({FORMATO[t].minutos}) · cartones {FORMATO[t].letra}
            </option>
          ))}
        </select>
      </Etiqueta>
      <p className="text-sm text-profundo/70 md:col-span-2">
        Bingo musical: en Conducir, «Sacar bolilla» elige una canción al azar y suena el estribillo; el título aparece cuando
        termina. Repartí los cartones <b>{FORMATO[tipo].letra}</b> ({FORMATO[tipo].nombre}). Los sets y los cartones se arman en{' '}
        <Link to="/admin/bingo" className="font-semibold text-azul underline">
          Bingo
        </Link>
        .
      </p>
    </div>
  )
}
