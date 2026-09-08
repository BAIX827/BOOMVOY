import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  // GitHub Pages 仓库页是 /repo-name/；本地开发保持 /
  base: process.env.GITHUB_PAGES_BASE || '/',
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 5173,
    // Keep the same-origin proxy private too; otherwise LAN clients could use it
    // to reach the unauthenticated paid routes bound to the backend loopback.
    host: '127.0.0.1',
    fs: {
      // Preserve Vite's default secret-file exclusions and hide backend storage,
      // including temporary atomic-write files and direct /@fs/ requests.
      deny: ['.env', '.env.*', '*.{crt,pem}', '**/.git/**', '**/server/data/**'],
    },
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8787',
        changeOrigin: true,
      },
    },
  },
  optimizeDeps: {
    include: ['leaflet', 'react-leaflet'],
  },
})
