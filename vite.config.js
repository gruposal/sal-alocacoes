import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    plugins: [react()],
    base: '/',
    build: {
      outDir: 'dist',
      sourcemap: false
    },
    server: {
      proxy: {
        // Em dev, /api/clickup/... → api.clickup.com/api/v2/...
        // Token via VITE_CLICKUP_TOKEN em .env.local
        '/api/clickup': {
          target: 'https://api.clickup.com',
          changeOrigin: true,
          rewrite: path => path.replace(/^\/api\/clickup/, '/api/v2'),
          configure: (proxy) => {
            proxy.on('proxyReq', (proxyReq) => {
              const token = env.VITE_CLICKUP_TOKEN || '';
              if (token) proxyReq.setHeader('Authorization', token);
            });
          }
        }
      }
    }
  }
})
