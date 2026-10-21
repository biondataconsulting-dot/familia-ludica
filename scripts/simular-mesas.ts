// Simula mesas jugando una noche, con la misma carga que celulares reales: cada mesa se registra,
// escucha los avisos en tiempo real, relee el estado cada 5 s, late cada 10 s y responde cada ítem
// abierto con algo al azar, después de "pensar" unos segundos. El conductor maneja la noche desde el
// panel como siempre. Al llegar al podio (o con Ctrl+C) muestra cuánto tardó cada cosa.
//
// Uso: npm run simular -- CODIGO [mesas] [pensar_max_s]
//   npm run simular -- NAUDIR3            15 mesas, responden entre 2 y 15 s después de abrir
//   npm run simular -- NAUDIR3 25 8       25 mesas, responden entre 2 y 8 s
// Las mesas se llaman "Simulada 01", "Simulada 02"… Para sacarlas: "Reiniciar noche" en el
// ensayo (borra todas las mesas, respuestas y puntos de esa noche).
import { createClient, type RealtimeChannel, type SupabaseClient } from '@supabase/supabase-js'

const url = process.env.VITE_SUPABASE_URL
const key = process.env.VITE_SUPABASE_ANON_KEY
if (!url || !key) {
  console.error('Faltan VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY en .env.local')
  process.exit(1)
}

const CODIGO = (process.argv[2] ?? '').toUpperCase()
const CANTIDAD = Number(process.argv[3] ?? 15)
const PENSAR_MAX_S = Number(process.argv[4] ?? 15)
if (!/^[A-Z0-9]{3,12}$/.test(CODIGO) || !Number.isInteger(CANTIDAD) || CANTIDAD < 1 || CANTIDAD > 30 || !(PENSAR_MAX_S >= 2)) {
  console.error('Uso: npm run simular -- CODIGO [mesas, 1 a 30] [pensar_max_s, desde 2]')
  process.exit(1)
}

const RELECTURA_MS = 5000
const LATIDO_MS = 10000
const AGRUPAR_AVISOS_MS = 150

type Live = {
  phase: string
  event: { settings: { misiones?: boolean; desafios?: boolean } }
  block: { dynamic: string; title: string } | null
  item: { block_item_id: string; type: string; content: Record<string, unknown> } | null
}
type Mesa = { team_id: string; token: string; name: string; pin: string }

// ---------------------------------------------------------------- medición

const tiempos: Record<string, number[]> = {}
const errores: Record<string, string[]> = {}

async function medir<T>(nombre: string, fn: () => PromiseLike<{ data: T | null; error: { message: string } | null }>): Promise<T | null> {
  const inicio = performance.now()
  try {
    const { data, error } = await fn()
    ;(tiempos[nombre] ??= []).push(performance.now() - inicio)
    if (error) {
      ;(errores[nombre] ??= []).push(error.message)
      return null
    }
    return data
  } catch (e) {
    ;(errores[nombre] ??= []).push(e instanceof Error ? e.message : String(e))
    return null
  }
}

function percentil(valores: number[], p: number) {
  const orden = [...valores].sort((a, b) => a - b)
  return orden[Math.min(orden.length - 1, Math.floor((p / 100) * orden.length))] ?? 0
}

function resumen() {
  console.log('\n──────── Resumen ────────')
  console.log('Llamada            cant.   mediana     p95      máx.  errores')
  for (const [nombre, v] of Object.entries(tiempos)) {
    const ms = (x: number) => `${Math.round(x)} ms`.padStart(8)
    console.log(
      `${nombre.padEnd(18)}${String(v.length).padStart(5)}${ms(percentil(v, 50))}${ms(percentil(v, 95))}${ms(Math.max(...v))}${String(errores[nombre]?.length ?? 0).padStart(9)}`,
    )
  }
  const distintos = new Map<string, number>()
  for (const lista of Object.values(errores)) for (const m of lista) distintos.set(m, (distintos.get(m) ?? 0) + 1)
  if (distintos.size) {
    console.log('\nErrores:')
    for (const [m, n] of distintos) console.log(`  ${n} × ${m}`)
  }
  console.log(`\nRespuestas enviadas: ${enviadas} · avisos en tiempo real recibidos: ${avisos}`)
}

// ---------------------------------------------------------------- respuestas al azar

const azar = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min
const TITULOS = ['Volver al futuro', 'La bamba', 'Titanic', 'De música ligera', 'Thriller', 'Matrix', '']
const ARTISTAS = ['Soda Stereo', 'Michael Jackson', 'Spielberg', 'Queen', 'Los Fabulosos Cadillacs', '']

function respuestaAlAzar(live: Live): Record<string, unknown> | null {
  const item = live.item
  if (!item) return null
  const c = item.content
  switch (live.block?.dynamic) {
    case 'trivia':
      return { opcion: azar(0, Math.max(0, (Array.isArray(c.opciones) ? c.opciones.length : 4) - 1)) }
    case 'dos_verdades':
      return { opcion: azar(0, 2) }
    case 'aproximaciones':
      return { valor: c.formato === 'anio' ? azar(1900, 2025) : azar(0, 10000) }
    case 'hipster':
    case 'cine':
      return { anio: azar(1960, 2024), titulo: TITULOS[azar(0, TITULOS.length - 1)], artista: ARTISTAS[azar(0, ARTISTAS.length - 1)] }
    default:
      return null
  }
}

// ---------------------------------------------------------------- una mesa = un celular

let enviadas = 0
let avisos = 0
const canales: { cliente: SupabaseClient; canal: RealtimeChannel }[] = []
const intervalos: ReturnType<typeof setInterval>[] = []

async function jugar(nombre: string) {
  // Un cliente por mesa: cada celular tiene su propia conexión.
  const cliente = createClient(url!, key!, { auth: { persistSession: false } })
  const mesa = await medir<Mesa>('join_team', () => cliente.rpc('join_team', { p_code: CODIGO, p_name: nombre }))
  if (!mesa) {
    console.log(`✘ ${nombre} no pudo entrar: ${errores.join_team?.at(-1)}`)
    return
  }
  const respondidos = new Set<string>()
  let pendiente: ReturnType<typeof setTimeout> | undefined

  const cargar = async () => {
    const live = await medir<Live>('get_live', () => cliente.rpc('get_live', { p_code: CODIGO }))
    // Con misiones o desafíos prendidos, el celular también lee el módulo en cada relectura.
    if (live?.event.settings.misiones || live?.event.settings.desafios) {
      void medir('get_extras', () => cliente.rpc('get_extras', { p_code: CODIGO, p_token: mesa.token }))
    }
    if (live?.phase === 'final' && !terminando) {
      console.log('\nLlegó el podio: fin de la simulación.')
      void terminar()
      return
    }
    const id = live?.item?.block_item_id
    if (!live || live.phase !== 'item_open' || !id || respondidos.has(id)) return
    respondidos.add(id)
    setTimeout(async () => {
      const respuesta = respuestaAlAzar(live)
      if (!respuesta) return
      const ok = await medir('submit_answer', () => cliente.rpc('submit_answer', { p_token: mesa.token, p_block_item_id: id, p_answer: respuesta }))
      if (ok) enviadas++
    }, azar(2000, PENSAR_MAX_S * 1000))
  }
  const pedirPronto = () => {
    avisos++
    clearTimeout(pendiente)
    pendiente = setTimeout(() => void cargar(), AGRUPAR_AVISOS_MS)
  }

  const canal = cliente.channel(`evento:${CODIGO}`).on('broadcast', { event: 'cambio' }, pedirPronto).subscribe()
  canales.push({ cliente, canal })
  intervalos.push(setInterval(() => void cargar(), RELECTURA_MS))
  intervalos.push(setInterval(() => void medir('heartbeat', () => cliente.rpc('heartbeat', { p_token: mesa.token })), LATIDO_MS))
  void cargar()
  console.log(`✔ ${nombre} (PIN ${mesa.pin})`)
}

console.log(`Simulando ${CANTIDAD} mesas en ${CODIGO} (${url}). Responden entre 2 y ${PENSAR_MAX_S} s después de abrir.`)
console.log('Conducí la noche desde el panel. Termina sola en el podio (o con Ctrl+C) y muestra el resumen.\n')
for (let i = 1; i <= CANTIDAD; i++) {
  await jugar(`Simulada ${String(i).padStart(2, '0')}`)
}

// Avance cada 30 s, para ver que sigue vivo.
intervalos.push(setInterval(() => console.log(`… ${enviadas} respuestas enviadas, ${avisos} avisos recibidos`), 30000))

let terminando = false
async function terminar() {
  if (terminando) return
  terminando = true
  for (const id of intervalos) clearInterval(id)
  resumen()
  await Promise.all(canales.map(({ cliente, canal }) => cliente.removeChannel(canal)))
  process.exit(Object.keys(errores).length ? 1 : 0)
}
process.on('SIGINT', () => void terminar())
// Para pruebas automáticas: SIMULAR_SEGUNDOS=120 corta solo.
const limite = Number(process.env.SIMULAR_SEGUNDOS)
if (limite > 0) setTimeout(() => void terminar(), limite * 1000)
