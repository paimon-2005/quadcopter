import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  server: {
    proxy: {
      '/cam': {
        target: 'http://10.226.233.16',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/cam/, ''),
      },
    },
  },
})
