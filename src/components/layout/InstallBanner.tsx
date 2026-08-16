import { useState } from 'react'
import { useLocation } from 'react-router'
import { Download, Share, X } from 'lucide-react'

import { usePwaInstall, type InstallResult } from '@/hooks/usePwaInstall'
import { useSettings } from '@/contexts/SettingsContext'
import { useI18n } from '@/lib/i18n'
import { Button } from '@/components/ui/button'
import { InstallAppDialog } from '@/components/layout/InstallAppButton'
import { cn } from '@/lib/utils'

const DISMISS_KEY = 'booking-install-banner-dismissed'

/**
 * InstallBanner — prominent mobile install prompt that slides up above the
 * bottom tab bar on every page (not hidden inside a menu).
 *
 * - Shows only on phones (md:hidden), when the app isn't installed yet, and
 *   only once per session (dismissed with the X stays gone until reload).
 * - Android/Chrome → fires the native install prompt.
 * - iOS / unsupported → opens the step-by-step Add-to-Home-Screen dialog.
 */
export function InstallBanner() {
  const { canInstall, installed, install, isIOS } = usePwaInstall()
  const { branding } = useSettings()
  const { t } = useI18n()
  const location = useLocation()
  const [showHelp, setShowHelp] = useState(false)
  const [dismissed, setDismissed] = useState(
    () => typeof window !== 'undefined' && sessionStorage.getItem(DISMISS_KEY) === '1'
  )

  // Hide on the booking flow — its sticky bottom action bar owns that space.
  const onBookingFlow = location.pathname === '/book'
  if (installed || !canInstall || dismissed || onBookingFlow) return null

  const handleInstall = async () => {
    const result: InstallResult = await install()
    if (result === 'unavailable') setShowHelp(true)
  }

  const handleDismiss = () => {
    setDismissed(true)
    try {
      sessionStorage.setItem(DISMISS_KEY, '1')
    } catch {
      // sessionStorage unavailable (private mode) — just hide for this render.
    }
  }

  return (
    <>
      <div className="fixed inset-x-0 z-40 px-3 pb-3 md:hidden" style={{ bottom: 'calc(64px + env(safe-area-inset-bottom))' }}>
        <div
          className="banner-slide-up flex items-center gap-3 rounded-2xl border bg-card/95 p-3 shadow-xl backdrop-blur"
          style={{ borderColor: 'var(--app-border, rgba(0,0,0,0.08))' }}
        >
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Download className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold leading-snug">{t('banner.title')}</p>
            <p className="truncate text-xs text-muted-foreground">
              {isIOS ? t('banner.subIos', { app: branding.appName }) : t('banner.sub', { app: branding.appName })}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <Button size="sm" className="gap-1.5" onClick={() => void handleInstall()}>
              {isIOS ? <Share className="h-3.5 w-3.5" /> : <Download className="h-3.5 w-3.5" />}
              {t('banner.install')}
            </Button>
            <button
              onClick={handleDismiss}
              aria-label={t('banner.dismiss')}
              className={cn(
                'flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-colors',
                'hover:bg-accent hover:text-foreground'
              )}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      <InstallAppDialog
        open={showHelp}
        onOpenChange={setShowHelp}
        isIOS={isIOS}
        appName={branding.appName || 'this app'}
      />
    </>
  )
}
