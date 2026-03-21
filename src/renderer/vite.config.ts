import { resolve } from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  root: __dirname,
  plugins: [tailwindcss(), react()],
  resolve: {
    alias: {
      '@renderer': resolve(__dirname, 'src')
    }
  }
})
