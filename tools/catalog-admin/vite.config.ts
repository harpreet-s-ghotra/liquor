import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { catalogAdminApiPlugin } from './server/api'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  Object.assign(process.env, env)

  return {
    plugins: [react(), catalogAdminApiPlugin()],
    server: {
      host: '127.0.0.1',
      port: 5181,
      strictPort: true
    }
  }
})
