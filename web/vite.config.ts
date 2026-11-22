import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

// API_URL is set by Docker Compose (http://api:8080); native runs fall back to localhost.
const apiUrl = process.env.API_URL ?? 'http://localhost:8080'

export default defineConfig({
  plugins: [react()],
  server: { proxy: { '/v1': apiUrl } },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test-setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
  },
})
