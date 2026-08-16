import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'sonner'

import '@fontsource-variable/plus-jakarta-sans'
// Base styles for react-day-picker (v8 ships its styles separately). Imported
// BEFORE our globals.css so the theme overrides in globals.css win.
import 'react-day-picker/dist/style.css'

import { queryClient } from '@/lib/queryClient'
import { SettingsProvider } from '@/contexts/SettingsContext'
import { AppRouter } from '@/routes/AppRouter'

import '@/styles/globals.css'

// Register the PWA service worker (no-op in dev, active in production build).
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  navigator.serviceWorker.ready.then(() => {
    // vite-plugin-pwa registers the generated SW for us; this just waits for it
  })
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <SettingsProvider>
        <AppRouter />
        <Toaster richColors position="top-right" />
      </SettingsProvider>
    </QueryClientProvider>
  </StrictMode>
)
