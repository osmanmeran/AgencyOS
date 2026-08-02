import type { CapacitorConfig } from '@capacitor/cli';

// The WebView loads the real deployed Client Portal origin directly (rather
// than bundling `dist/` into the app) so cookies/CORS/CSP/WebSocket all stay
// same-origin and work exactly as they do in a browser — no backend changes
// needed. `webDir` above is still required by the Capacitor CLI even though
// it's unused at runtime in this remote-server mode.
//
// For local development against `npm run dev`, temporarily point this at
// `http://10.0.2.2:5173` (Android emulator) or `http://localhost:5173` (with
// `adb reverse tcp:5173 tcp:5173` on a physical device), then switch back to
// the real workspace URL before building a distributable APK.
const config: CapacitorConfig = {
  appId: 'app.marvelops.client',
  appName: 'Marvelops',
  webDir: 'dist',
  server: {
    url: 'https://REPLACE-WITH-WORKSPACE-SLUG.marvelops.app',
    androidScheme: 'https',
  },
};

export default config;
