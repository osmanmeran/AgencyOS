import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import path from 'path';

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
          if (!id.includes('node_modules')) return undefined;
          // Order matters: more specific package matchers must come before the
          // generic `react` / `vendor` fallbacks below, since several package
          // names contain the substring 'react'.
          if (id.includes('node_modules/lucide-react')) return 'icons';
          if (id.includes('node_modules/@tanstack')) return 'tanstack';
          if (id.includes('node_modules/next-themes')) return 'themes';
          if (
            id.includes('node_modules/sonner') ||
            id.includes('node_modules/vaul') ||
            id.includes('node_modules/cmdk')
          )
            return 'ui-headless';
          if (id.includes('node_modules/date-fns') || id.includes('node_modules/dayjs')) return 'dates';
          if (id.includes('node_modules/@mui')) return 'mui';
          if (id.includes('node_modules/@emotion')) return 'emotion';
          // Maps + charts must be matched BEFORE the react-vendor rule below,
          // since their package names contain the substring 'react'.
          if (
            id.includes('node_modules/leaflet') ||
            id.includes('node_modules/react-leaflet') ||
            id.includes('node_modules/@react-leaflet')
          )
            return 'maps';
          if (id.includes('node_modules/framer-motion')) return 'motion';
          if (id.includes('node_modules/react-quill') || id.includes('node_modules/quill')) return 'editor';
          if (
            id.includes('node_modules/jspdf') ||
            id.includes('node_modules/pdfkit') ||
            id.includes('node_modules/html2canvas')
          )
            return 'pdf';
          if (id.includes('node_modules/@radix-ui')) return 'radix';
          // React + its first-party ecosystem live in their own base chunk so
          // other split chunks depend on this instead of the catch-all
          // `vendor` — that avoids the circular vendor <-> charts/maps chunk
          // warning while still keeping the monolithic vendor small.
          if (
            id.includes('node_modules/react-dom') ||
            id.includes('node_modules/scheduler') ||
            id.includes('node_modules/prop-types') ||
            id.includes('node_modules/react-is') ||
            id.includes('node_modules/loose-envify') ||
            id.includes('node_modules/object-assign') ||
            /node_modules\/react\/|.+node_modules\/react$/.test(id)
          )
            return 'react-vendor';
          if (
            id.includes('node_modules/recharts') ||
            id.includes('node_modules/recharts-scale') ||
            id.includes('node_modules/react-smooth') ||
            id.includes('node_modules/victory-vendor') ||
            id.includes('node_modules/eventemitter3') ||
            id.includes('node_modules/decimal.js') ||
            id.includes('node_modules/d3-')
          )
            return 'charts';
          return 'vendor';
        },
      },
    },
  },
  plugins: [react()],
});
