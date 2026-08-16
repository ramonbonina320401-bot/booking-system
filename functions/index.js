/**
 * Booking push notifications — Firebase Cloud Function.
 *
 * 1. sendBookingStatusPush — fires whenever a booking doc is updated. When
 *    the status changes to `confirmed` or `cancelled`, it looks up the booking
 *    owner's FCM device token (profiles/{uid}.fcm_token — set from the
 *    Profile page) and sends a web push notification.
 *
 * 2. sendBookingReminders — scheduled every 5 minutes. Finds CONFIRMED
 *    bookings that start within the next REMIND_BEFORE_MINUTES and sends a
 *    "your booking starts soon" push, then stamps `reminder_sent_at` on the
 *    history doc so each booking is reminded exactly once.
 *
 * Deploy:
 *   npm i -g firebase-tools
 *   firebase login
 *   firebase deploy --only functions
 *
 * NOTE: Cloud Functions (including scheduled functions) require the Blaze
 * (pay-as-you-go) plan. The client-side hook (useBookingReminders) covers the
 * free Spark plan while the app is open; this function covers the app being
 * closed / on another device.
 */
const { onDocumentUpdated } = require('firebase-functions/v2/firestore')
const { onSchedule } = require('firebase-functions/v2/scheduler')
const { initializeApp } = require('firebase-admin/app')
const { getFirestore } = require('firebase-admin/firestore')
const { getMessaging } = require('firebase-admin/messaging')

initializeApp()
const db = getFirestore()

const NOTIFIABLE_STATUSES = new Set(['confirmed', 'cancelled'])

/** Default lead time (minutes) when system_settings/booking_reminder_minutes
 *  hasn't been set yet. The admin can change it from Settings → Booking hours
 *  (15–180 min); the client hook reads the same setting. */
const DEFAULT_REMIND_MINUTES = 30

/** Read the admin-configured reminder lead time, clamped to 15–180 min. */
async function getRemindBeforeMinutes() {
  try {
    const snap = await db.doc('system_settings/booking_reminder_minutes').get()
    const value = Number(snap.data()?.value)
    if (Number.isFinite(value) && value >= 15 && value <= 180) return value
  } catch {
    // settings unreadable — fall through to the default
  }
  return DEFAULT_REMIND_MINUTES
}

/** Read the optional days-before reminder (0 = off, 1–7 days). */
async function getRemindDays() {
  try {
    const snap = await db.doc('system_settings/booking_reminder_days').get()
    const value = Number(snap.data()?.value)
    if (Number.isFinite(value) && value >= 0 && value <= 7) return Math.floor(value)
  } catch {
    // settings unreadable — fall through to the default
  }
  return 0
}

/** Format a booking start for human-friendly push bodies (en-PH locale). */
function formatStart(startTime) {
  const start = new Date(startTime)
  if (Number.isNaN(start.getTime())) return String(startTime ?? '')
  return start.toLocaleString('en-PH', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

/** Resolve a human-friendly resource name for a booking. */
async function resolveResourceName(resourceId) {
  try {
    const snap = await db.doc(`resources/${resourceId}`).get()
    const name = snap.data()?.name
    return name || 'Resource'
  } catch {
    return 'Resource'
  }
}

/** Send a web push to the user's device token; clean up dead tokens. */
async function sendPush(userId, profileSnap, title, body) {
  const token = profileSnap.data()?.fcm_token
  if (!token) return
  try {
    await getMessaging().send({
      token,
      notification: { title, body },
      webpush: {
        fcm_options: { link: '/my-bookings' },
      },
    })
  } catch (err) {
    const code = err && err.code ? err.code : ''
    if (code === 'messaging/registration-token-not-registered') {
      // Device unregistered (app deleted / token rotated) — stop retrying it.
      console.log(`[push] token for ${userId} no longer registered — clearing`)
      await profileSnap.ref.update({ fcm_token: null }).catch(() => undefined)
    } else {
      console.warn(`[push] send failed for ${userId}: ${code}`, err.message || err)
    }
  }
}

exports.sendBookingStatusPush = onDocumentUpdated('bookings/{bookingId}', async (event) => {
  const before = event.data.before.data()
  const after = event.data.after.data()
  if (!before || !after) return

  const newStatus = after.status
  if (!NOTIFIABLE_STATUSES.has(newStatus)) return
  if (before.status === newStatus) return
  // Only notify on the meaningful transitions (pending → confirmed, and
  // pending/confirmed → cancelled), not e.g. completed → cancelled cleanups.
  if (newStatus === 'confirmed' && before.status !== 'pending') return
  if (newStatus === 'cancelled' && !['pending', 'confirmed'].includes(before.status)) return

  const userId = after.user_id
  if (!userId) return

  const profileSnap = await db.doc(`profiles/${userId}`).get()
  if (!profileSnap.exists) return

  const resourceName = await resolveResourceName(after.resource_id)
  const time = formatStart(after.start_time)

  const title = newStatus === 'confirmed' ? 'Booking confirmed' : 'Booking cancelled'
  const body =
    newStatus === 'confirmed'
      ? `${resourceName} · ${time}`
      : `${resourceName} on ${time} was cancelled`

  await sendPush(userId, profileSnap, title, body)
})

/**
 * Scheduled booking reminders — every 5 minutes.
 *
 * Queries only on `start_ms` (single-field range, auto-indexed — no composite
 * index needed in the console) and filters status/reminder state in code, so
 * deploying this function never requires an index setup step.
 */
exports.sendBookingReminders = onSchedule('every 5 minutes', async () => {
  const now = Date.now()
  const remindBeforeMinutes = await getRemindBeforeMinutes()
  const remindDays = await getRemindDays()
  const minutesMs = remindBeforeMinutes * 60 * 1000
  const daysMs = remindDays > 0 ? remindDays * 24 * 60 * 60 * 1000 : 0
  // Cover the longer of the two windows in one query (single-field range,
  // auto-indexed — no composite index needed in the console).
  const windowEnd = now + Math.max(minutesMs, daysMs)

  const snap = await db
    .collection('booking_history')
    .where('start_ms', '>=', now)
    .where('start_ms', '<=', windowEnd)
    .limit(400)
    .get()

  let sent = 0
  for (const doc of snap.docs) {
    const data = doc.data()
    if (data.status !== 'confirmed') continue
    if (!data.user_id) continue

    const profileSnap = await db.doc(`profiles/${data.user_id}`).get()
    if (!profileSnap.exists) continue

    const resourceName = await resolveResourceName(data.resource_id)
    const time = formatStart(data.start_time)
    const startMs = data.start_ms ?? new Date(data.start_time).getTime()

    // 1. Minutes-before reminder — closest to the booking.
    if (startMs <= now + minutesMs) {
      if (data.reminder_sent_at) continue
      await sendPush(
        data.user_id,
        profileSnap,
        'Booking reminder',
        `${resourceName} starts soon · ${time}`
      )
      await doc.ref.update({ reminder_sent_at: now })
      sent++
      continue
    }

    // 2. Days-before reminder — earlier heads-up, outside the minutes window.
    if (daysMs > 0 && startMs <= now + daysMs) {
      if (data.reminder_day_sent_at) continue
      await sendPush(
        data.user_id,
        profileSnap,
        'Booking reminder',
        `${resourceName} is coming up · ${time}`
      )
      await doc.ref.update({ reminder_day_sent_at: now })
      sent++
    }
  }

  if (sent > 0) console.log(`[reminders] sent ${sent} reminder(s)`)
})
