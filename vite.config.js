import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  logLevel: 'info',
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  server: {
    host: true,
    port: 5173,
    allowedHosts: true,
    proxy: {
      // Trailing slash matters: a bare '/api' prefix also matches
      // /api-client.js (string-prefix matching), which sent that static
      // asset to the backend's stale dist/ build instead of the live
      // source in public/ during dev.
      '/api/': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
  build: {
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/lucide-react')) return 'icons';
          if (id.includes('node_modules/@tanstack')) return 'tanstack';
          if (id.includes('node_modules/next-themes')) return 'themes';
          if (id.includes('node_modules/sonner') || id.includes('node_modules/vaul') || id.includes('node_modules/cmdk')) return 'ui-headless';
          if (id.includes('node_modules/date-fns') || id.includes('node_modules/dayjs')) return 'dates';
          if (id.includes('node_modules')) return 'vendor';
        },
      },
    },
  },
  plugins: [
    react(),
  ]
});
