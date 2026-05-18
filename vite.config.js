import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/',
  build: {
    outDir: 'dist',
    sourcemap: false
  },
  server: {
    proxy: {
      // Em dev, /api/clickup/v2/... → api.clickup.com/api/v2/...
      // Token via VITE_CLICKUP_TOKEN em .env.local
      '/api/clickup': {
        target: 'https://api.clickup.com',
        changeOrigin: true,
        rewrite: path => path.replace(/^\/api\/clickup/, '/api'),
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq) => {
            const token = process.env.VITE_CLICKUP_TOKEN || '';
            if (token) proxyReq.setHeader('Authorization', token);
          });
        }
      }
    }
  }
})
