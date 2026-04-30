import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

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
          proxy.on('error', (err) => {
            console.log('proxy error (non-fatal):', err.code);
          });
        },
      },
    },
  },
})
