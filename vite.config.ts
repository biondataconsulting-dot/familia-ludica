import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

/** Versión de esta publicación: viaja en el código y en /version.json, para avisar a las pantallas viejas. */
const VERSION = Date.now().toString(36)

export default defineConfig({
  define: { __VERSION__: JSON.stringify(VERSION) },
  plugins: [
    react(),
    {
      name: 'version-json',
      generateBundle() {
        this.emitFile({ type: 'asset', fileName: 'version.json', source: JSON.stringify({ version: VERSION }) })
      },
    },
  ],
  // Solo desarrollo: en Windows el vigilante de archivos a veces se pierde cambios; el sondeo es más confiable.
  server: { watch: { usePolling: true, interval: 300 } },
  test: {
    include: ['src/**/*.test.ts'],
  },
})
