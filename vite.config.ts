import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // Solo desarrollo: en Windows el vigilante de archivos a veces se pierde cambios; el sondeo es más confiable.
  server: { watch: { usePolling: true, interval: 300 } },
  test: {
    include: ['src/**/*.test.ts'],
  },
})
