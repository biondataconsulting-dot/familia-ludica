import type { TipoExtra } from './rpc'

export const NOMBRE: Record<TipoExtra, { plural: string; singular: string; ayuda: string }> = {
  mision: {
    plural: 'Misiones secretas',
    singular: 'misión',
    ayuda: 'Para todas las mesas. Se abren y se cierran todas juntas; cada mesa que la cumple suma los puntos.',
  },
  desafio: {
    plural: 'Desafíos',
    singular: 'desafío',
    ayuda: 'Se lanzan de a uno en el momento. Solo suma la primera mesa que lo cumple.',
  },
}
