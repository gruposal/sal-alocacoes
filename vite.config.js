import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// Espelha em dev os rewrites do vercel.json:
// /legacy(/*) → index-legacy.html (v1), qualquer outro caminho "de página"
// (raiz, /:unidade, /v2 e /v2/:slug legados) → index.html (v2, app principal).
function shortLinks() {
  return {
    name: 'short-links',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const pathname = (req.url || '').split('?')[0];
        if (pathname.includes('.') || pathname.startsWith('/@') || pathname.startsWith('/api')) {
          return next();
        }
        if (pathname === '/legacy' || pathname.startsWith('/legacy/')) {
          req.url = '/index-legacy.html';
        } else {
          req.url = '/index.html';
        }
        next();
      });
    },
  };
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    plugins: [react(), shortLinks()],
    base: '/',
    build: {
      outDir: 'dist',
      sourcemap: false,
      rollupOptions: {
        input: {
          main:   'index.html',
          legacy: 'index-legacy.html',
        },
      },
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
