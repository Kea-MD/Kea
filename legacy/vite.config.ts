import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// @ts-expect-error process is a nodejs global
const host = process.env.TAURI_DEV_HOST

export default defineConfig({
  root: 'legacy',
  plugins: [vue()],
  build: {
    outDir: '../dist-legacy',
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('@codemirror') || id.includes('@lezer')) return 'vendor-codemirror'
            if (id.includes('primevue') || id.includes('primeicons')) return 'vendor-primevue'
            if (id.includes('vue') || id.includes('pinia')) return 'vendor-vue'
          }
        },
      },
    },
  },
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    fs: {
      allow: ['..'],
    },
    hmr: host
      ? { protocol: 'ws', host, port: 1421 }
      : undefined,
    watch: {
      ignored: ['**/src-tauri/**'],
    },
  },
})
