import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

if (!url || !anonKey) {
  throw new Error('Faltan VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY. Copiá .env.example como .env.local y completalo.')
}

/** Cliente único con la clave anon (pública). La clave service_role nunca va en el frontend. */
export const supabase = createClient(url, anonKey)
