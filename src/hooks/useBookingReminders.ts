import { useCallback, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'

import { useAuth } from '@/hooks/useAuth'
import { useBookings } from '@/hooks/useBookings'
import { useSettings } from '@/contexts/SettingsContext'
import { useI18n } from '@/lib/i18n'
import { formatDateTime } from '@/lib/timeSlots'

// ---------------------------------------------------------------------------
// useBookingReminders — client-side booking reminders.
//
// The free Spark plan can't run the scheduled Cloud Function
// (sendBookingReminders in /functions — requires Blaze), so this hook covers
// the app being open: it watches the user's bookings in real time (the
// existing useBookings onSnapshot) and surfaces a toast + a real system
// notification when a CONFIRMED booking is about to start.
//
// Two configurable reminders (admin → Settings → Booking hours):
//   1. minutes-before — fires when the booking is within
//      system_settings/booking_reminder_minutes of starting.
//   2. days-before (optional) — fires when the booking is within
//      system_settings/booking_reminder_days days of starting but NOT yet
//      inside the minutes window (so users get the earlier heads-up only).
//
// Dedup is per-device and per-reminder-type (localStorage keys
// `min-<bookingId>` / `day-<bookingId>`) so each reminder fires exactly once
// per booking. When the user upgrades to Blaze and deploys the function,
// reminders also arrive as FCM pushes while the app is closed.
// ---------------------------------------------------------------------------

const STORAGE_KEY = 'booking-reminders-sent'

/** Reminders we've already fired on THIS device (key → when). */
function loadSent(): Record<string, number> {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') as Record<string, number>
  } catch {
    return {}
  }
}

function saveSent(sent: Record<string, number>): void {
  try {
    // Prune entries older than a week so the key never grows unbounded.
    const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000
    for (const [key, at] of Object.entries(sent)) {
      if (at < cutoff) delete sent[key]
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sent))
  } catch {
    // Storage unavailable (private mode) — reminders just won't dedup.
  }
}

/** Show the reminder toast with a "View" action that deep-links to the
 *  user's bookings. Clicking the toast body does the same.
 *  `navigate` comes from the caller so the toast works inside the router. */
function showReminderToast(
  title: string,
  body: string,
  navigate: (to: string) => void,
  viewLabel: string
): void {
  toast(title, {
    description: body,
    action: {
      label: viewLabel,
      onClick: () => navigate('/my-bookings'),
    },
  })
}

/** Show a real system notification via the app's service worker, if allowed.
 *  The click handler in the SW reads `data.url` and opens My Bookings. */
async function showSystemNotification(title: string, body: string, tag: string): Promise<void> {
  try {
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return
    if (!('serviceWorker' in navigator)) {
      // Fallback without a SW: a page-created notification still shows.
      new Notification(title, { body, icon: '/icons/icon-192.png' })
      return
    }
    const reg = await navigator.serviceWorker.ready
    await reg.showNotification(title, {
      body,
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      tag,
      data: { url: '/my-bookings' },
    })
  } catch {
    // Notifications are best-effort — never break the app over them.
  }
}

export function useBookingReminders() {
  const { user } = useAuth()
  const { data: bookings } = useBookings()
  const { bookingConfig } = useSettings()
  const { t } = useI18n()
  const navigate = useNavigate()
  const sentRef = useRef<Record<string, number>>(loadSent())
  const remindBeforeMs = bookingConfig.reminderMinutes * 60 * 1000
  const remindDaysMs = bookingConfig.reminderDays * 24 * 60 * 60 * 1000

  const check = useCallback(() => {
    const uid = user?.id
    if (!uid || !bookings?.length) return

    const now = Date.now()
    let changed = false

    for (const booking of bookings) {
      if (booking.status !== 'confirmed') continue
      const start = new Date(booking.start_time).getTime()
      if (Number.isNaN(start) || start <= now) continue

      const name = booking.resource?.name ?? t('reminder.resource')
      const when = formatDateTime(booking.start_time)
      const title = t('reminder.title')

      // 1. Minutes-before reminder — closest to the booking.
      if (start <= now + remindBeforeMs) {
        const key = `min-${booking.id}`
        if (sentRef.current[key]) continue
        sentRef.current[key] = now
        changed = true
        const body = t('reminder.body', { name, when })
        showReminderToast(title, body, navigate, t('reminder.view'))
        void showSystemNotification(title, body, key)
        continue
      }

      // 2. Days-before reminder — earlier heads-up, only outside the minutes
      //    window so the two never fire together.
      if (remindDaysMs > 0 && start <= now + remindDaysMs) {
        const key = `day-${booking.id}`
        if (sentRef.current[key]) continue
        sentRef.current[key] = now
        changed = true
        const body = t('reminder.bodyDay', { name, when })
        showReminderToast(title, body, navigate, t('reminder.view'))
        void showSystemNotification(title, body, key)
      }
    }

    if (changed) saveSent(sentRef.current)
  }, [bookings, navigate, remindBeforeMs, remindDaysMs, t, user?.id])

  useEffect(() => {
    check()
    // Re-check once a minute while the app is open — a booking can cross into
    // a reminder window without any Firestore data change.
    const interval = setInterval(check, 60_000)
    return () => clearInterval(interval)
  }, [check])
}
