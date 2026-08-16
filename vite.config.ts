import { defineConfig } from 'vite'
import path from 'path'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// ---------------------------------------------------------------------------
// vite.config.ts
// ---------------------------------------------------------------------------
// PWA: vite-plugin-pwa auto-generates the service worker + web manifest at
// build time. The *static* manifest (public/manifest.json) holds build-time
// defaults; the app then injects a *dynamic* manifest (name, colors, icons
// from system_settings) via src/lib/pwa.ts once settings load — see README.
//
// navigateFallback: MUST be '/index.html' for an SPA. A static offline page
// would be served for every non-root route (the service worker can't know
// /book vs /admin are app routes), breaking navigation in production.
// The app shell + assets are precached, so the app still boots offline and
// its own error/empty states handle missing data.
// ---------------------------------------------------------------------------

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      // Dev-only SW disabled by default so HMR stays fast
      devOptions: { enabled: false },
      registerType: 'autoUpdate',
      strategies: 'injectManifest',
      // injectManifest (not generateSW): the service worker source is OUR file
      // (src/sw.ts), which merges Workbox precaching with Firebase Cloud
      // Messaging push handling — a separate FCM worker at the same scope
      // would replace the precache worker and break offline caching.
      srcDir: 'src',
      filename: 'sw.ts',
      includeAssets: ['favicon.svg', 'icons/*.png'],
      manifest: false, // we ship our own manifest.json so we can swap it at runtime
      injectManifest: {
        // Cache-first for static assets. Booking data is live, so offline is
        // intentionally limited: the app shell still loads, data fails
        // gracefully with the app's own error states.
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom'],
          'vendor-router': ['react-router'],
          'vendor-query': ['@tanstack/react-query'],
          'vendor-icons': ['lucide-react'],
          // Firebase SDK in its own chunk: it's large (auth + firestore ≈
          // 190KB gzip) and rarely changes, so it can be cached by browsers
          // across deploys and fetched in parallel with the app code.
          // NOTE: firebase/messaging + firebase/installations are intentionally
          // NOT here — src/lib/fcm.ts imports them via dynamic import, so
          // Rollup gives them their own async chunk that is only downloaded
          // when a user with push enabled loads the app (not on first paint).
          'vendor-firebase': [
            'firebase/app',
            'firebase/auth',
            'firebase/firestore',
          ],
          'vendor-dates': ['date-fns'],
          'vendor-toast': ['sonner'],
        },
      },
    },
  },
})
