// Verifica con la clave anon (la misma que usa el navegador) qué se puede y qué no se puede hacer.
// Uso: npm run verificar:rls   (lee VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY de .env.local)
import { createClient } from '@supabase/supabase-js'

const url = process.env.VITE_SUPABASE_URL
const key = process.env.VITE_SUPABASE_ANON_KEY
if (!url || !key) {
  console.error('Faltan VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY en .env.local')
  process.exit(1)
}

const supabase = createClient(url, key, { auth: { persistSession: false } })
const CODIGO = 'NAUDIR3'
let fallas = 0

function resultado(ok: boolean, texto: string, detalle = '') {
  if (!ok) fallas++
  console.log(`${ok ? '✔' : '✘'} ${texto}${detalle ? ` — ${detalle}` : ''}`)
}

/** Una lectura está bloqueada si da error o no devuelve filas. */
async function noLee(tabla: string, columnas = '*') {
  const { data, error } = await supabase.from(tabla).select(columnas).limit(1)
  const bloqueado = Boolean(error) || (data?.length ?? 0) === 0
  resultado(bloqueado, `anon NO lee ${tabla}${columnas === '*' ? '' : `.${columnas}`}`, error?.message ?? `${data?.length ?? 0} filas`)
}

console.log(`Proyecto: ${url}\n`)

// Lo que NO se puede
await noLee('catalog_solutions')
await noLee('catalog_items')
await noLee('teams', 'token')
await noLee('teams', 'pin')
await noLee('answers')
await noLee('score_entries')
await noLee('admins')
await noLee('live_state')

{
  const { data, error } = await supabase.from('live_state').update({ phase: 'final' }).neq('phase', '').select()
  resultado(Boolean(error) || (data?.length ?? 0) === 0, 'anon NO actualiza live_state', error?.message ?? `${data?.length ?? 0} filas`)
}
{
  const { error } = await supabase.from('live_state').insert({ event_id: crypto.randomUUID() })
  resultado(Boolean(error), 'anon NO inserta en live_state', error?.message ?? 'se insertó')
}
{
  const { error } = await supabase.from('catalog_solutions').delete().neq('item_id', crypto.randomUUID())
  resultado(Boolean(error), 'anon NO borra catalog_solutions', error?.message ?? 'no dio error')
}

// Lo que SÍ se puede
{
  const { data, error } = await supabase.rpc('get_live', { p_code: CODIGO })
  const live = data as { phase?: string; event?: { name?: string } } | null
  resultado(!error && Boolean(live?.phase), `anon SÍ llama get_live('${CODIGO}')`, error?.message ?? `fase ${live?.phase}, "${live?.event?.name}"`)
  const texto = JSON.stringify(data ?? {})
  resultado(!texto.includes('correcta') && !texto.includes('youtube_id'), 'get_live no trae soluciones ni youtube_id')
}
{
  const { data, error } = await supabase.rpc('get_event_public', { p_code: CODIGO.toLowerCase() })
  resultado(!error && Boolean(data), 'anon SÍ llama get_event_public (sin importar mayúsculas)', error?.message ?? '')
}
{
  const { error } = await supabase.rpc('get_live', { p_code: 'NOEXISTE' })
  resultado(Boolean(error?.message.startsWith('No encontramos')), 'código inexistente da error claro en español', error?.message ?? 'no dio error')
}
{
  const { data, error } = await supabase.from('public_teams').select('*').limit(1)
  const columnas = data?.[0] ? Object.keys(data[0]) : []
  resultado(!error && !columnas.includes('token') && !columnas.includes('pin'), 'anon SÍ lee public_teams, sin token ni PIN', error?.message ?? `columnas: ${columnas.join(', ') || '(sin mesas todavía)'}`)
}
for (const vista of ['ranking', 'ranking_by_block', 'answered_teams', 'public_item']) {
  const { error } = await supabase.from(vista).select('*').limit(1)
  resultado(!error, `anon SÍ lee ${vista}`, error?.message ?? '')
}

console.log(fallas ? `\n${fallas} verificaciones fallaron.` : '\nTodo en orden.')
process.exit(fallas ? 1 : 0)
