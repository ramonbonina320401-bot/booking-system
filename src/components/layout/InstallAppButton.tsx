import { useState } from 'react'
import { Download, MonitorSmartphone, Share, Smartphone, Sparkles } from 'lucide-react'

import { usePwaInstall, type InstallResult } from '@/hooks/usePwaInstall'
import { useSettings } from '@/contexts/SettingsContext'
import { useI18n } from '@/lib/i18n'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

interface InstallAppButtonProps {
  /** 'icon' = compact round button (navbar/header). 'menu' = full-width row (dropdowns/mobile nav). */
  variant?: 'icon' | 'menu'
  /** Called after the click is handled (e.g. close an open dropdown/mobile menu). */
  onNavigate?: () => void
  /** Render the built-in instructions dialog. Disable when the parent unmounts
   *  this component on click (dropdowns) — pass onOpenHelp instead and render
   *  <InstallAppDialog> yourself at a level that survives the close. */
  showDialog?: boolean
  /** Called when the native prompt is unavailable and help is needed. */
  onOpenHelp?: () => void
  className?: string
}

/**
 * InstallAppButton — always-visible "Download the app" entry point.
 *
 * - Chrome/Edge/Android: fires the NATIVE install prompt (beforeinstallprompt).
 * - iOS Safari: no native prompt exists, so it opens a step-by-step modal
 *   (Share → Add to Home Screen) instead of a dead button.
 * - Already installed (running standalone): renders nothing.
 */
export function InstallAppButton({
  variant = 'icon',
  onNavigate,
  showDialog = true,
  onOpenHelp,
  className,
}: InstallAppButtonProps) {
  const { canInstall, installed, install, isIOS } = usePwaInstall()
  const { branding } = useSettings()
  const { t } = useI18n()
  const [showHelp, setShowHelp] = useState(false)

  if (installed || !canInstall) return null

  const appName = branding.appName || 'this app'

  const handleClick = async () => {
    onNavigate?.()
    const result: InstallResult = await install()
    // Only a MISSING native prompt needs the instructions modal — a dismissed
    // native prompt already showed the user the real install UI.
    if (result === 'unavailable') {
      if (onOpenHelp) onOpenHelp()
      else setShowHelp(true)
    }
  }

  if (variant === 'menu') {
    return (
      <>
        <button
          onClick={() => void handleClick()}
          className="flex w-full items-center gap-3 rounded-xl p-2.5 text-sm font-medium transition-colors hover:bg-accent"
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-secondary text-secondary-foreground">
            <Download className="h-4 w-4" />
          </div>
          <div className="text-left">
            <p className="text-sm font-medium">{t('menu.installApp')}</p>
            <p className="text-xs text-muted-foreground">
              {isIOS ? t('menu.addHomeScreen') : t('menu.downloadDevice')}
            </p>
          </div>
        </button>
        {showDialog && (
          <InstallAppDialog open={showHelp} onOpenChange={setShowHelp} isIOS={isIOS} appName={appName} />
        )}
      </>
    )
  }

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => void handleClick()}
        aria-label={t('install.aria')}
        title={t('install.aria')}
        className={cn('relative', className)}
      >
        <Download className="h-5 w-5" />
      </Button>
      {showDialog && (
        <InstallAppDialog open={showHelp} onOpenChange={setShowHelp} isIOS={isIOS} appName={appName} />
      )}
    </>
  )
}

// ---------------------------------------------------------------------------
// InstallHelpDialog — instructions for platforms without a native prompt
// (iOS Safari, unsupported desktop browsers).
// ---------------------------------------------------------------------------

export interface InstallHelpDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  isIOS: boolean
  appName: string
}

export function InstallAppDialog({ open, onOpenChange, isIOS, appName }: InstallHelpDialogProps) {
  const { t } = useI18n()

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Smartphone className="h-5 w-5" />
            </span>
            {t('install.title', { app: appName })}
          </DialogTitle>
          <DialogDescription>{t('install.desc', { app: appName })}</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {isIOS ? (
            <>
              <Step
                n={1}
                icon={<Share className="h-4 w-4" />}
                title={t('install.step1Title')}
                desc={t('install.step1Desc')}
              />
              <Step
                n={2}
                icon={<Download className="h-4 w-4" />}
                title={t('install.step2Title')}
                desc={t('install.step2Desc')}
              />
              <Step
                n={3}
                icon={<Sparkles className="h-4 w-4" />}
                title={t('install.step3Title')}
                desc={t('install.step3Desc', { app: appName })}
              />
            </>
          ) : (
            <>
              <Step
                n={1}
                icon={<MonitorSmartphone className="h-4 w-4" />}
                title={t('install.step4Title')}
                desc={t('install.step4Desc')}
              />
              <Step
                n={2}
                icon={<Download className="h-4 w-4" />}
                title={t('install.step5Title')}
                desc={t('install.step5Desc')}
              />
              <Step
                n={3}
                icon={<Sparkles className="h-4 w-4" />}
                title={t('install.step6Title')}
                desc={t('install.step6Desc', { app: appName })}
              />
            </>
          )}
        </div>

        <p className="text-xs text-muted-foreground">{t('install.tip', { app: appName })}</p>
      </DialogContent>
    </Dialog>
  )
}

interface StepProps {
  n: number
  icon: React.ReactNode
  title: string
  desc: string
}

function Step({ n, icon, title, desc }: StepProps) {
  return (
    <div className="flex items-start gap-3 rounded-xl border bg-muted/40 p-3">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-sm font-semibold">
          <span className="mr-1.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">
            {n}
          </span>
          {title}
        </p>
        <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{desc}</p>
      </div>
    </div>
  )
}
