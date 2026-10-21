import { describe, expect, it } from 'vitest'
import { ESTADO_YT, sonidoBloqueado } from './youtube'

describe('sonidoBloqueado', () => {
  it('suena con volumen: no', () => expect(sonidoBloqueado(ESTADO_YT.REPRODUCIENDO, false, true)).toBe(false))
  it('suena silenciado (el navegador lo forzó): sí', () => expect(sonidoBloqueado(ESTADO_YT.REPRODUCIENDO, true, true)).toBe(true))
  it('en pausa (cerrar, revelar, corte del fragmento): nunca', () => {
    expect(sonidoBloqueado(ESTADO_YT.PAUSADO, false, false)).toBe(false)
    expect(sonidoBloqueado(ESTADO_YT.PAUSADO, true, false)).toBe(false)
  })
  it('cargando (internet lenta): no', () => expect(sonidoBloqueado(ESTADO_YT.CARGANDO, false, false)).toBe(false))
  it('terminado: no', () => expect(sonidoBloqueado(ESTADO_YT.TERMINADO, false, false)).toBe(false))
  it('sin arrancar y nadie tocó la pantalla: sí', () => {
    expect(sonidoBloqueado(ESTADO_YT.SIN_EMPEZAR, false, false)).toBe(true)
    expect(sonidoBloqueado(ESTADO_YT.EN_COLA, false, false)).toBe(true)
  })
  it('sin arrancar pero con «Comenzar la noche» tocado: no (es carga lenta, la reintenta sola)', () =>
    expect(sonidoBloqueado(ESTADO_YT.SIN_EMPEZAR, false, true)).toBe(false))
})
