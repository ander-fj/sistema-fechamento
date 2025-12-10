import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  
  // 🔧 Fix para o erro "failed to resolve import react-is"
  optimizeDeps: {
    include: ['react-is']
  },

  build: {
    rollupOptions: {
      external: ['react-is'] // garante que o Vercel/Vite não trave no build
    }
  },

  server: {
    port: 3001,
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin-allow-popups',
    },
  },
})

