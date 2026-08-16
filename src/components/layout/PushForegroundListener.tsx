import { useEffect } from 'react'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'

import { useI18n } from '@/lib/i18n'

/**
 * PushForegroundListener — shows a toast when a push notification arrives
 * while the app is open (browsers suppress the system notification when the
 * tab has focus, so the app surfaces it itself).
 *
 * BUNDLE NOTE: `firebase/messaging` is ~20KB gzipped and only useful for
 * users who enabled push, so it is imported DYNAMICALLY here instead of at
 * the top of the module. Combined with the fcm_token gate in AppRouter, the
 * messaging SDK never enters the first-load bundle — it only downloads when
 * a push-enabled user actually opens the app.
 */
export function PushForegroundListener() {
  const { t } = useI18n()
  const navigate = useNavigate()

  useEffect(() => {
    let cancelled = false
    let unsubscribe: (() => void) | null = null
    void import('@/lib/fcm').then(({ subscribeToForegroundMessages }) => {
      if (cancelled) return
      unsubscribe = subscribeToForegroundMessages((payload) => {
        // Tapping the toast opens My Bookings — matches the background
        // notification click (SW reads data.url → /my-bookings).
        toast(payload.title ?? t('push.defaultTitle'), {
          description: payload.body,
          action: {
            label: t('reminder.view'),
            onClick: () => navigate('/my-bookings'),
          },
        })
      })
    })
    return () => {
      cancelled = true
      unsubscribe?.()
    }
  }, [navigate, t])

  return null
}
