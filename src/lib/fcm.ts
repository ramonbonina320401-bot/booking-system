import {
  getMessaging,
  getToken,
  deleteToken,
  onMessage,
  isSupported,
  type Messaging,
} from 'firebase/messaging'
import { doc, updateDoc } from 'firebase/firestore'

import { app, db } from '@/lib/firebase'

// ---------------------------------------------------------------------------
// fcm.ts — Firebase Cloud Messaging (web push) client helpers.
//
// The token is stored on the user's profile doc (profiles/{uid}.fcm_token).
// A Cloud Function (see /functions) sends the actual notification when a
// booking is confirmed or cancelled, so no send happens from the browser.
//
// The VAPID public key (VITE_FIREBASE_VAPID_KEY) is a public value — get it
// from Firebase console → Project settings → Cloud Messaging → Web push
// certificates → Key pair.
// ---------------------------------------------------------------------------

let messaging: Messaging | null | undefined

/** Lazily resolve the Messaging instance; null when the browser doesn't
 *  support web push (e.g. no service worker / insecure context). */
export async function getMessagingInstance(): Promise<Messaging | null> {
  if (messaging !== undefined) return messaging
  const supported = await isSupported()
  messaging = supported ? getMessaging(app) : null
  return messaging
}

const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY

export type PushSetupResult = { ok: boolean; error: string | null }

/** Ask for permission, obtain an FCM token for this device, and store it on
 *  the user's profile doc so the Cloud Function can target it. */
export async function enablePush(userId: string): Promise<PushSetupResult> {
  try {
    const m = await getMessagingInstance()
    if (!m) {
      return { ok: false, error: 'Web push is not supported in this browser.' }
    }
    if (!VAPID_KEY) {
      return {
        ok: false,
        error: 'Push is not configured yet. The admin needs to add the VAPID key to the app settings.',
      }
    }
    const permission = await Notification.requestPermission()
    if (permission !== 'granted') {
      return {
        ok: false,
        error:
          permission === 'denied'
            ? 'Notifications are blocked in your browser. Enable them in browser settings, then try again.'
            : 'Permission not granted.',
      }
    }
    // Use the app's own (merged) service worker — sw.js bundles FCM handling.
    const registration = await navigator.serviceWorker.ready
    const token = await getToken(m, { vapidKey: VAPID_KEY, serviceWorkerRegistration: registration })
    await updateDoc(doc(db, 'profiles', userId), { fcm_token: token, updated_at: Date.now() })
    return { ok: true, error: null }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Could not enable notifications.' }
  }
}

/** Delete the device token and clear it from the profile doc. */
export async function disablePush(userId: string): Promise<PushSetupResult> {
  try {
    const m = await getMessagingInstance()
    if (m) {
      await deleteToken(m).catch(() => undefined)
    }
    await updateDoc(doc(db, 'profiles', userId), { fcm_token: null, updated_at: Date.now() })
    return { ok: true, error: null }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Could not disable notifications.' }
  }
}

/** Current permission state — 'unsupported' when the API is unavailable. */
export function getPushPermission(): NotificationPermission | 'unsupported' {
  if (typeof Notification === 'undefined') return 'unsupported'
  return Notification.permission
}

export interface ForegroundPushPayload {
  title?: string
  body?: string
}

/** Listen for messages received while the app is open (foreground). Returns
 *  an unsubscribe function. The notification UI (toast/banner) is up to the
 *  caller — browsers suppress the system notification while the tab is open. */
export function subscribeToForegroundMessages(cb: (payload: ForegroundPushPayload) => void): () => void {
  let unsub: (() => void) | null = null
  void getMessagingInstance().then((m) => {
    if (!m) return
    unsub = onMessage(m, (payload) => {
      cb({ title: payload.notification?.title, body: payload.notification?.body })
    })
  })
  return () => {
    unsub?.()
  }
}
