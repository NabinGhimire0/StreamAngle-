import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    allowedHosts: '178d-2400-1a00-1b61-74a3-3c31-ed25-7cf7-7689.ngrok-free.app'
  },
})
