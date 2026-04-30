import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import process from 'node:process'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api/eleven': {
        target: 'https://api.elevenlabs.io',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/api\/eleven/, ''),
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq) => {
            if (process.env.ELEVENLABS_API_KEY) {
              proxyReq.setHeader('xi-api-key', process.env.ELEVENLABS_API_KEY);
            }
          });
          proxy.on('error', (err) => {
            console.log('proxy error (non-fatal):', err.code);
          });
        },
      },
      '/api/groq': {
        target: 'https://api.groq.com',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/api\/groq/, ''),
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq) => {
            if (process.env.GROQ_API_KEY) {
              proxyReq.setHeader('Authorization', `Bearer ${process.env.GROQ_API_KEY}`);
            }
          });
          proxy.on('error', (err) => {
            console.log('proxy error (non-fatal):', err.code);
          });
        },
      },
    },
  },
})
