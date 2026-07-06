import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// Espelha em dev os rewrites de link curto por unidade do vercel.json
// (/v2, /v2/:slug, /:unidade → index-v2.html), para poder testar localmente.
function v2ShortLinks() {
  return {
    name: 'v2-short-links',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const pathname = (req.url || '').split('?')[0];
        if (pathname.includes('.') || pathname.startsWith('/@') || pathname.startsWith('/api')) {
          return next();
        }
        const parts = pathname.split('/').filter(Boolean);
        const isV2Root    = parts.length === 0 ? false : parts[0] === 'v2' && parts.length <= 2;
        const isBareSlug  = parts.length === 1 && parts[0] !== 'v2';
        if (pathname === '/v2' || isV2Root || isBareSlug) {
          req.url = '/index-v2.html';
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
    plugins: [react(), v2ShortLinks()],
    base: '/',
    build: {
      outDir: 'dist',
      sourcemap: false,
      rollupOptions: {
        input: {
          main: 'index.html',
          v2:   'index-v2.html',
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
