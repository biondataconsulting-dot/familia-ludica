import type { Config } from 'tailwindcss'

// Los colores leen las variables CSS de src/index.css (canales RGB) para admitir opacidad.
const color = (name: string) => `rgb(var(--fl-${name}) / <alpha-value>)`

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        naranja: color('naranja'),
        azul: color('azul'),
        celeste: color('celeste'),
        profundo: color('profundo'),
        crema: color('crema'),
        amarillo: color('amarillo'),
      },
      fontFamily: {
        titulo: ['Fredoka', 'system-ui', 'sans-serif'],
        texto: ['"Nunito Sans"', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        carta: '1.25rem',
      },
      minHeight: {
        toque: '48px',
      },
    },
  },
  plugins: [],
} satisfies Config
