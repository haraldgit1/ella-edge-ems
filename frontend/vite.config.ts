import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: '/ella_ems/',
  server: {
    proxy: {
      '/ella_ems/api': {
        target: 'http://localhost:3000',
        rewrite: (path) => path.replace(/^\/ella_ems/, ''),
      },
      '/ella_ems/sim': {
        target: 'http://localhost:8080',
        rewrite: (path) => path.replace(/^\/ella_ems/, ''),
      },
    },
  },
})
