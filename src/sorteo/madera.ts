/**
 * Sonido de la ruleta de madera, generado en el navegador (Web Audio, sin archivos): un "clac" seco
 * cada vez que pasa un nombre por la lengüeta, y uno más grave al detenerse. El proyector ya tiene el
 * toque de «Comenzar la noche», así que el navegador lo deja sonar.
 */

let contexto: AudioContext | null = null
let ruido: AudioBuffer | null = null

function audio(): AudioContext | null {
  try {
    if (!contexto) {
      const Clase = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      if (!Clase) return null
      contexto = new Clase()
    }
    if (contexto.state === 'suspended') void contexto.resume()
    return contexto
  } catch {
    return null
  }
}

function rafaga(c: AudioContext): AudioBuffer {
  if (ruido && ruido.sampleRate === c.sampleRate) return ruido
  const largo = Math.ceil(c.sampleRate * 0.045)
  ruido = c.createBuffer(1, largo, c.sampleRate)
  const d = ruido.getChannelData(0)
  for (let i = 0; i < largo; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / largo, 5)
  return ruido
}

/** Un golpe de madera. `final` = el último, más grave y fuerte. */
export function golpeMadera(final = false) {
  const c = audio()
  if (!c || c.state !== 'running') return
  const t = c.currentTime
  const salida = c.createGain()
  salida.gain.value = final ? 0.9 : 0.55
  salida.connect(c.destination)

  // El chasquido de la lengüeta contra el clavo.
  const chasquido = c.createBufferSource()
  chasquido.buffer = rafaga(c)
  const filtro = c.createBiquadFilter()
  filtro.type = 'bandpass'
  filtro.frequency.value = (final ? 1100 : 1800) + Math.random() * 250
  filtro.Q.value = 2.5
  chasquido.connect(filtro).connect(salida)
  chasquido.start(t)

  // El cuerpo de la madera: un tono corto que cae.
  const cuerpo = c.createOscillator()
  cuerpo.type = 'triangle'
  cuerpo.frequency.setValueAtTime(final ? 230 : 430, t)
  cuerpo.frequency.exponentialRampToValueAtTime(final ? 110 : 260, t + 0.07)
  const volumen = c.createGain()
  volumen.gain.setValueAtTime(final ? 0.6 : 0.3, t)
  volumen.gain.exponentialRampToValueAtTime(0.001, t + (final ? 0.18 : 0.07))
  cuerpo.connect(volumen).connect(salida)
  cuerpo.start(t)
  cuerpo.stop(t + 0.2)
}
