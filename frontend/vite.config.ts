import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss()
  ],
  server: {
    host: '0.0.0.0',
    port: 3000,
    proxy: {
      // Single catch-all for all backend API routes — avoids route-ordering conflicts
      '/api': {
        target: 'http://127.0.0.1:8001',
        changeOrigin: true,
        // Disable response buffering so MJPEG multipart streams flow through in real-time
        configure: (proxy) => {
          proxy.on('proxyRes', (proxyRes) => {
            proxyRes.headers['x-accel-buffering'] = 'no';
          });
        }
      },
      '/ws': {
        target: 'ws://127.0.0.1:8001',
        ws: true
      },
      '/clips': {
        target: 'http://127.0.0.1:8001',
        changeOrigin: true
      },
      '/videos': {
        target: 'http://127.0.0.1:8001',
        changeOrigin: true
      }
    }
  }
})
