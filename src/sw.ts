/// <reference lib="webworker" />
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching'
import { NavigationRoute, registerRoute } from 'workbox-routing'
import { initializeApp } from 'firebase/app'
import { getMessaging, onBackgroundMessage } from 'firebase/messaging/sw'

declare let self: ServiceWorkerGlobalScope

// ---------------------------------------------------------------------------
// Merged service worker: Workbox precache (offline app shell) + Firebase Cloud
// Messaging (web push). A SEPARATE firebase-messaging-sw.js at the same scope
// would replace this worker and silently break offline caching — bundling both
// here keeps the two features on one worker.
// ---------------------------------------------------------------------------

// Precache manifest injected at build time by vite-plugin-pwa (injectManifest).
const manifest = (self as unknown as { __WB_MANIFEST: Parameters<typeof precacheAndRoute>[0] }).__WB_MANIFEST
precacheAndRoute(manifest)
cleanupOutdatedCaches()

// SPA navigation fallback — the same behavior generateSW provided.
registerRoute(new NavigationRoute(createHandlerBoundToURL('/index.html')))

// ---- Firebase Cloud Messaging (web push) ----
const app = initializeApp({
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
})
const messaging = getMessaging(app)

onBackgroundMessage(messaging, (payload) => {
  const { title, body, icon } = payload.notification ?? {}
  self.registration.showNotification(title ?? 'Booking System', {
    body,
    icon: icon ?? '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    // Tapping the notification lands on the user's bookings.
    data: { url: '/my-bookings' },
  })
})

// Tapping a notification takes the user to their bookings (default) — or to
// whatever URL the notification carried in its `data.url`.
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = event.notification.data?.url ?? '/my-bookings'
  event.waitUntil(
    (async () => {
      const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      for (const client of clients) {
        if ('focus' in client) {
          await client.navigate(url)
          return client.focus()
        }
      }
      return self.clients.openWindow(url)
    })()
  )
})
