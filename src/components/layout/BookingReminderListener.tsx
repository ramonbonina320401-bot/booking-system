import { useBookingReminders } from '@/hooks/useBookingReminders'

/**
 * BookingReminderListener — runs the client-side booking reminder engine for
 * the signed-in user (toast + system notification when a confirmed booking is
 * about to start). Renders nothing.
 *
 * Lives alongside PushForegroundListener: that one shows pushes that arrive
 * from the server (FCM), this one shows reminders computed locally while the
 * app is open — the free-plan path that needs no Cloud Function deployment.
 */
export function BookingReminderListener() {
  useBookingReminders()
  return null
}
