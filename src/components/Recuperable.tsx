import { Component, type ReactNode } from 'react'

type Props = { children: ReactNode; fondo?: 'azul' | 'crema' }
type Estado = { fallo: boolean; intento: number }

const REINTENTO_MS = 3000

/**
 * Si algo de la pantalla falla al dibujarse, en vez de quedar en blanco muestra "Reconectando…"
 * y se vuelve a montar sola a los pocos segundos (spec §11: cada pantalla se recupera sola).
 */
export class Recuperable extends Component<Props, Estado> {
  state: Estado = { fallo: false, intento: 0 }
  private espera: number | undefined

  static getDerivedStateFromError(): Partial<Estado> {
    return { fallo: true }
  }

  componentDidCatch(error: unknown) {
    console.error('Pantalla recuperada tras un error:', error)
    window.clearTimeout(this.espera)
    this.espera = window.setTimeout(() => this.setState((s) => ({ fallo: false, intento: s.intento + 1 })), REINTENTO_MS)
  }

  componentWillUnmount() {
    window.clearTimeout(this.espera)
  }

  render() {
    if (this.state.fallo) {
      const azul = this.props.fondo === 'azul'
      return (
        <div className={`flex min-h-screen items-center justify-center ${azul ? 'bg-azul text-white' : 'bg-crema text-profundo'}`}>
          <p className="font-titulo text-2xl font-semibold">Reconectando…</p>
        </div>
      )
    }
    // La key nueva fuerza a montar todo de cero en cada reintento.
    return <div key={this.state.intento} className="contents">{this.props.children}</div>
  }
}
