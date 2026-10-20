import { describe, expect, it } from 'vitest'
import { CASOS_ITEMS } from './casos-items'
import { leerImportacion, parsearCsv } from './importar'
import { idDeYouTube, validarItem } from './validarItem'

describe('validarItem (mismos casos que SQL)', () => {
  for (const c of CASOS_ITEMS) {
    it(c.nombre, () => {
      const error = validarItem(c.tipo, c.contenido, c.solucion)
      if (c.error === null) expect(error).toBeNull()
      else expect(error).toContain(c.error)
    })
  }
})

describe('idDeYouTube', () => {
  it('acepta links y ids', () => {
    expect(idDeYouTube('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=42')).toBe('dQw4w9WgXcQ')
    expect(idDeYouTube('https://youtu.be/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ')
    expect(idDeYouTube('https://www.youtube.com/shorts/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ')
    expect(idDeYouTube(' dQw4w9WgXcQ ')).toBe('dQw4w9WgXcQ')
  })
})

describe('leerImportacion: JSON de la spec', () => {
  const json = JSON.stringify([
    {
      tipo: 'pregunta_opciones',
      etiquetas: ['variada'],
      dificultad: 'facil',
      contenido: { texto: '¿Cuántas piezas tiene un dominó clásico?', opciones: ['28', '32', '24', '36'] },
      solucion: { correcta: 0, explicacion: 'Doble seis: 28 fichas.' },
    },
    {
      tipo: 'pista_audio',
      etiquetas: ['80s', 'rock nacional'],
      contenido: { youtube_id: 'XXXXXXXXXXX', inicio: 42, duracion: 20, categoria: 'musica' },
      solucion: { anio: 1986, titulo: 'Persiana americana', artista: 'Soda Stereo', variantes_titulo: [], variantes_artista: ['Soda'] },
    },
    { tipo: 'pista_audio', contenido: { youtube_id: 'corto' }, solucion: {} },
  ])
  it('lee cada fila y marca los errores por fila', () => {
    const { filas, error } = leerImportacion(json)
    expect(error).toBeNull()
    expect(filas.map((f) => f.error === null)).toEqual([true, true, false])
    expect(filas[1]!.item!.etiquetas).toEqual(['80s', 'rock nacional'])
    expect(filas[2]!.error).toContain('11 caracteres')
  })
  it('JSON roto o que no es lista', () => {
    expect(leerImportacion('[{').error).toMatch(/no es válido/)
    expect(leerImportacion('{"tipo":"x"}').error).toMatch(/una lista/)
  })
})

describe('leerImportacion: CSV', () => {
  const csv = [
    'tipo,etiquetas,dificultad,contenido_json,solucion_json',
    'pregunta_opciones,variada|juegos,facil,"{""texto"":""¿Cuántas, casillas?"",""opciones"":[""49"",""64""]}","{""correcta"":1}"',
    'trio_verdad_mentira,,media,"{""afirmaciones"":[""a"",""b"",""c""]}","{""mentira"":2}"',
    'pregunta_opciones,,,no es json,{}',
  ].join('\n')
  it('con comillas, comas adentro y etiquetas con |', () => {
    const { filas, error } = leerImportacion(csv)
    expect(error).toBeNull()
    expect(filas).toHaveLength(3)
    expect(filas[0]!.item!.contenido.texto).toBe('¿Cuántas, casillas?')
    expect(filas[0]!.item!.etiquetas).toEqual(['variada', 'juegos'])
    expect(filas[1]!.error).toBeNull()
    expect(filas[2]!.error).toMatch(/contenido_json no es un JSON/)
  })
  it('punto y coma como separador (Excel en español)', () => {
    const { filas } = leerImportacion(csv.split('\n').map((l, i) => (i === 0 ? l.replace(/,/g, ';') : l)).join('\n').replace(/^tipo/, 'tipo'))
    expect(filas.length).toBeGreaterThan(0)
  })
  it('avisa las columnas que faltan', () => {
    expect(leerImportacion('tipo,etiquetas\nx,y').error).toMatch(/faltan columnas: dificultad, contenido_json, solucion_json/)
  })
  it('parsearCsv respeta saltos de línea dentro de comillas', () => {
    expect(parsearCsv('a,"b\nc"\nd,e')).toEqual([
      ['a', 'b\nc'],
      ['d', 'e'],
    ])
  })
})
