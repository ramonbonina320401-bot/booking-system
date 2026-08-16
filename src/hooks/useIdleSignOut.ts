import { useEffect, useRef } from 'react'
import { toast } from 'sonner'

import { useAuth } from '@/hooks/useAuth'
import { useI18n } from '@/lib/i18n'

/**
 * Idle timeout — signs the user out after `timeoutMs` without any activity.
 *
 * Mounted once at the router level. Any real interaction (mouse, keyboard,
 * touch, scroll, click) resets the timer. This is a client-side hygiene
 * measure (like a shared-device auto-lock): it prevents an unattended session
 * from staying open on a public machine. Server-side session expiry is a
 * backend concern (planned for the ASP.NET API) — Firebase sessions can't be
 * force-expired from the client.
 */
export function useIdleSignOut(timeoutMs = 15 * 60_000) {
  const { user, signOut } = useAuth()
  const { t } = useI18n()
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!user) return

    const clearTimer = () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current)
        timerRef.current = null
      }
    }

    const reset = () => {
      clearTimer()
      timerRef.current = setTimeout(() => {
        void (async () => {
          await signOut()
          toast.info(t('idle.signedOut'))
        })()
      }, timeoutMs)
    }

    const EVENTS = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'wheel', 'click'] as const
    EVENTS.forEach((ev) => window.addEventListener(ev, reset, { passive: true }))
    reset() // start the clock on mount

    return () => {
      clearTimer()
      EVENTS.forEach((ev) => window.removeEventListener(ev, reset))
    }
  }, [user, timeoutMs, signOut, t])
}
