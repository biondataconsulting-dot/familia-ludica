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
      keyframes: {
        aparecer: {
          from: { opacity: '0', transform: 'scale(0.6)' },
          to: { opacity: '1', transform: 'scale(1)' },
        },
        ecualizador: {
          '0%, 100%': { transform: 'scaleY(0.25)' },
          '50%': { transform: 'scaleY(1)' },
        },
      },
      animation: {
        aparecer: 'aparecer 350ms cubic-bezier(0.34, 1.56, 0.64, 1) both',
        ecualizador: 'ecualizador 900ms ease-in-out infinite',
      },
    },
  },
  plugins: [],
} satisfies Config
