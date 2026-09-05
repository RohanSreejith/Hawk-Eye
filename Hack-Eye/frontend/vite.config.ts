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
      '/api/hawk/camera': {
        target: 'http://127.0.0.1:8001',
        changeOrigin: true,
        selfHandleResponse: false,
        configure: (proxy) => {
          proxy.on('proxyRes', (proxyRes) => {
            // Disable buffering for MJPEG streams
            proxyRes.headers['x-accel-buffering'] = 'no';
          });
        }
      },
      '/api': {
        target: 'http://127.0.0.1:8001',
        changeOrigin: true
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
