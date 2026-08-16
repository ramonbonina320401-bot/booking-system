import { Hammer, LogIn, LogOut } from 'lucide-react'

import { useSettings } from '@/contexts/SettingsContext'
import { useAuth } from '@/hooks/useAuth'
import { useI18n } from '@/lib/i18n'
import { Brand } from '@/components/layout/Brand'
import { Button } from '@/components/ui/button'
import { todayLabel } from '@/pages/LoginPage'

/**
 * MaintenanceScreen — full-page notice rendered when maintenance mode is on
 * and the visitor is not an admin. The message comes from system_settings
 * (maintenance_message), so admins can change it without redeploying.
 *
 * Mirrors the branded welcome hero of the login page so the whole auth
 * experience stays visually consistent (dynamic brand colors + logo).
 */
export function MaintenanceScreen() {
  const { maintenanceMessage, branding } = useSettings()
  const { user, signOut } = useAuth()
  const { lang, t } = useI18n()

  return (
    <div
      className="flex min-h-dvh items-center justify-center px-4 py-12"
      style={{ backgroundColor: 'var(--app-background)' }}
    >
      <div className="w-full max-w-sm">
        {/* Branded maintenance hero — same panel language as the login page */}
        <div
          className="relative mb-6 overflow-hidden rounded-3xl p-6 text-white shadow-lg"
          style={{
            background: `linear-gradient(135deg, var(--app-primary, #2563eb) 0%, var(--app-accent, #f59e0b) 130%)`,
          }}
        >
          {/* Decorative floating shapes */}
          <span
            className="pointer-events-none absolute -right-8 -top-10 h-32 w-32 rounded-full opacity-20"
            style={{ backgroundColor: 'white' }}
            aria-hidden="true"
          />
          <span
            className="pointer-events-none absolute -bottom-12 right-12 h-24 w-24 rounded-full opacity-10"
            style={{ backgroundColor: 'white' }}
            aria-hidden="true"
          />
          <span
            className="pointer-events-none absolute -left-6 -bottom-8 h-20 w-20 rounded-2xl opacity-15"
            style={{ backgroundColor: 'white', transform: 'rotate(20deg)' }}
            aria-hidden="true"
          />

          <div className="relative">
            <div className="hero-reveal flex items-center justify-between" style={{ animationDelay: '60ms' }}>
              <span className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-widest text-white/80">
                {todayLabel(lang)}
              </span>
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/20 backdrop-blur-sm">
                <Hammer className="h-4 w-4 text-white" />
              </span>
            </div>

            <div className="hero-reveal mt-4 flex items-center gap-3" style={{ animationDelay: '160ms' }}>
              <span className="inline-flex rounded-xl bg-white/95 px-3 py-1.5 shadow-sm">
                <Brand className="max-h-8" />
              </span>
            </div>

            <p className="mt-5 text-2xl font-bold tracking-tight">
              <span className="hero-type" style={{ animationDelay: '280ms' }}>
                {t('maint.under')}
                <span className="hero-caret" aria-hidden="true" />
              </span>
              <span className="hero-reveal block text-sm font-medium text-white/85" style={{ animationDelay: '560ms' }}>
                {t('maint.unavailable', { app: branding.appName })}
              </span>
            </p>
          </div>
        </div>

        {/* Message card */}
        <div className="rounded-2xl border bg-card p-6 text-card-foreground shadow-sm">
          <div className="mb-4 flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Hammer className="h-5 w-5" />
            </span>
            <div>
              <p className="text-sm font-bold">{t('maint.backSoon')}</p>
              <p className="text-xs text-muted-foreground">{t('maint.inProgress')}</p>
            </div>
          </div>
          <p className="text-sm text-muted-foreground">{maintenanceMessage}</p>
          {user ? (
            <Button variant="outline" className="mt-6 w-full" onClick={() => void signOut()}>
              <LogOut className="h-4 w-4" />
              {t('maint.signOut')}
            </Button>
          ) : (
            <Button asChild className="mt-6 w-full">
              <a href="/login">
                <LogIn className="h-4 w-4" />
                {t('maint.signIn')}
              </a>
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
