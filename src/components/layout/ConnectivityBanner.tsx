import { useEffect, useState } from 'react'
import { WifiOff } from 'lucide-react'

import { useI18n } from '@/lib/i18n'

/**
 * ConnectivityBanner — shows a slim banner when the device loses its network
 * connection and hides it again once the connection returns.
 * (The PWA caches the shell offline, so the app keeps working — this banner
 * tells the user their changes may not sync until they're back online.)
 */
export function ConnectivityBanner() {
  const { t } = useI18n()
  const [offline, setOffline] = useState(() => (typeof navigator !== 'undefined' ? !navigator.onLine : false))

  useEffect(() => {
    const on = () => setOffline(false)
    const off = () => setOffline(true)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => {
      window.removeEventListener('online', on)
      window.removeEventListener('offline', off)
    }
  }, [])

  if (!offline) return null

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-x-0 top-0 z-[60] flex items-center justify-center gap-2 bg-destructive px-4 py-2 text-center text-xs font-semibold text-destructive-foreground"
    >
      <WifiOff className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      {t('offline.banner')}
    </div>
  )
}
