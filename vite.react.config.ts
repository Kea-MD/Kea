import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const devHost = process.env.TAURI_DEV_HOST || '127.0.0.1'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  build: {
    outDir: 'dist-react',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        index: 'index.html',
      },
    },
  },
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    host: devHost,
    hmr: {
      protocol: 'ws',
      host: devHost,
      port: process.env.TAURI_DEV_HOST ? 1421 : 1420,
    },
    watch: {
      usePolling: true,
      interval: 100,
      ignored: (path, stats) => {
        if (/(^|[/\\])src-tauri([/\\]|$)/.test(path)) return true
        if (!stats?.isFile()) return false
        return /\.(md|markdown|mdown|mkd|txt)$/.test(path) || /\.kea\..*\.tmp$/.test(path)
      },
    },
  },
})
