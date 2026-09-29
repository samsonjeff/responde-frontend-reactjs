import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [
      react(),
      tailwindcss(),
    ],
    optimizeDeps: {
      exclude: ['maplibre-gl'],
    },
    // -- Dev server: proxy /api/* to the Express backend on Render.
    // This makes the browser treat all requests as same-origin, which is
    // required for httpOnly session cookies to be sent/received correctly.
    //
    // IMPORTANT: The backend (HTTPS on Render) sets cookies with `Secure`.
    // Browsers refuse to store `Secure` cookies over HTTP (local dev).
    // The configure handler below strips `Secure` and `SameSite=None` from
    // Set-Cookie headers so the browser actually stores the session cookie.
    server: {
      proxy: {
        '/api': {
          target: env.VITE_API_URL || 'https://messbot-928g.onrender.com',
          changeOrigin: true,
          secure: true,
          cookieDomainRewrite: 'localhost',
          configure: (proxy) => {
            proxy.on('proxyRes', (proxyRes) => {
              const setCookie = proxyRes.headers['set-cookie'];
              if (setCookie) {
                proxyRes.headers['set-cookie'] = setCookie.map((cookie) =>
                  cookie
                    .replace(/;\s*Secure/gi, '')
                    .replace(/;\s*SameSite=None/gi, '; SameSite=Lax')
                );
              }
            });
          },
        },
      },
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            const normalized = id.replace(/\\/g, '/');
            if (normalized.includes('node_modules/maplibre-gl/')) {
              return 'vendor-maplibre';
            }
            if (normalized.includes('node_modules/recharts/') || normalized.includes('node_modules/d3-')) {
              return 'vendor-charts';
            }
            if (normalized.includes('node_modules/framer-motion/')) {
              return 'vendor-motion';
            }
            if (normalized.includes('node_modules/@supabase/')) {
              return 'vendor-supabase';
            }
            if (
              normalized.includes('node_modules/react/') ||
              normalized.includes('node_modules/react-dom/') ||
              normalized.includes('node_modules/react-router-dom/') ||
              normalized.includes('node_modules/react-router/')
            ) {
              return 'vendor-react';
            }
          },
        },
      },
      chunkSizeWarningLimit: 1200,
    },
  };
})
