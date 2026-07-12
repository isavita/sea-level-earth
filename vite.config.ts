import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    target: 'es2020',
    // Three.js is legitimately large and is already split into its own async
    // chunk via the lazy-loaded globe; don't warn on it.
    chunkSizeWarningLimit: 2000,
  },
})
