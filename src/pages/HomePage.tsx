import { useState } from 'react'
import { Link } from 'react-router'
import { format, startOfToday } from 'date-fns'
import {
  ArrowRight,
  CalendarCheck2,
  DoorOpen,
  Presentation,
  ShieldCheck,
  Smartphone,
  Sparkles,
} from 'lucide-react'

import { useAuth } from '@/hooks/useAuth'
import { useSettings } from '@/contexts/SettingsContext'
import { useResources } from '@/hooks/useResources'
import { useTodayAvailability } from '@/hooks/useTodayAvailability'
import { usePwaInstall } from '@/hooks/usePwaInstall'
import { hapticTap } from '@/lib/haptics'
import { useI18n } from '@/lib/i18n'
import { HeroGlow } from '@/components/layout/HeroGlow'
import { InstallAppDialog } from '@/components/layout/InstallAppButton'
import { AnnouncementsBanner } from '@/components/layout/AnnouncementsBanner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardEyebrow, CardHeader, CardTitle } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

const SEGMENTS = 8

/** Segmented progress — the reference's discrete-block indicator. */
function Segments({ filled, total = SEGMENTS }: { filled: number; total?: number }) {
  const clamped = Math.max(0, Math.min(total, Math.round(filled)))
  return (
    <div className="mt-4 flex gap-1.5" aria-hidden="true">
      {Array.from({ length: total }).map((_, i) => (
        <span
          key={i}
          className={cn(
            'h-7 flex-1 rounded-lg',
            i < clamped ? 'bg-foreground' : 'border border-dashed border-foreground/40'
          )}
        />
      ))}
    </div>
  )
}

/** White icon circle — the reference's signature tile accent. */
function IconCircle({
  icon: Icon,
  dark = false,
  className,
}: {
  icon: typeof Sparkles
  dark?: boolean
  className?: string
}) {
  return (
    <span
      className={cn(
        'flex h-10 w-10 shrink-0 items-center justify-center rounded-full shadow-sm',
        // White circle in light mode; in dark mode a neutral circle so the
        // (light) icon keeps contrast instead of vanishing on pure white.
        dark ? 'bg-white/15 text-white' : 'bg-white text-foreground dark:bg-secondary dark:text-foreground',
        className
      )}
    >
      <Icon className="h-5 w-5" />
    </span>
  )
}

/** Resource-card skeleton grid — mirrors the "What you can book" tiles. */
function ResourceCardsSkeleton() {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" aria-hidden="true">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="rounded-2xl bg-muted/40 p-6">
          <Skeleton className="mx-auto h-12 w-12 rounded-full" />
          <Skeleton className="mx-auto mt-3 h-5 w-32 rounded-md" />
          <Skeleton className="mx-auto mt-2 h-4 w-3/4 rounded-md" />
          <Skeleton className="mx-auto mt-4 h-6 w-24 rounded-full" />
        </div>
      ))}
    </div>
  )
}

/**
 * Availability pill on each resource card.
 * - loading        → skeleton (never a flashy wrong value)
 * - ready          → real count from the slot docs (admin-visible; the rules
 *                    gate other users out, see useTodayAvailability)
 * - unknown        → neutral "Open today" — no misleading number
 */
function AvailabilityPill({ count, status }: { count?: number; status: 'loading' | 'ready' | 'unknown' }) {
  const { t } = useI18n()
  if (status === 'loading') return <Skeleton className="h-6 w-24 rounded-full" aria-hidden="true" />
  if (status === 'ready') {
    const free = count ?? 0
    return free > 0 ? (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden="true" />
        {t('home.freeToday', { count: free })}
      </span>
    ) : (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-xs font-semibold text-muted-foreground">
        {t('home.fullyBooked')}
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/5 px-3 py-1 text-xs font-semibold text-primary">
      <CalendarCheck2 className="h-3.5 w-3.5" aria-hidden="true" />
      {t('home.openToday')}
    </span>
  )
}

export function HomePage() {
  const { branding } = useSettings()
  const { user, profile } = useAuth()
  const { t } = useI18n()
  const { data: resources = [], isLoading } = useResources()
  const {
    data: availability = {},
    isError,
    isPending: availabilityPending,
  } = useTodayAvailability()
  const { canInstall, install, isIOS } = usePwaInstall()
  const [showInstallHelp, setShowInstallHelp] = useState(false)

  const isAdmin = profile?.role === 'admin'
  const activeCount = resources.length
  const availabilityStatus: 'loading' | 'ready' | 'unknown' = availabilityPending
    ? 'loading'
    : isError
      ? 'unknown'
      : 'ready'
  const totalFreeToday = Object.values(availability).reduce((sum, n) => sum + n, 0)

  const features = [
    {
      icon: CalendarCheck2,
      title: t('home.doubleBook'),
      desc: t('home.doubleBookDesc'),
      tone: 'white' as const,
    },
    {
      icon: ShieldCheck,
      title: t('home.maintenance'),
      desc: t('home.maintenanceDesc'),
      tone: 'tint' as const,
    },
    {
      icon: Smartphone,
      title: t('home.installable'),
      desc: t('home.installableDesc'),
      tone: 'dark' as const,
    },
  ]

  return (
    <main className="mx-auto max-w-7xl px-4 py-10 sm:py-14">
      {/* Announcements — notices + scheduled closures visible at the top */}
      <AnnouncementsBanner />

      {/* Hero — contained rounded card so the glow gradient never bleeds
          edge-to-edge (matches PageHero/AdminHero treatment). */}
      <section className="mb-10">
        <div className="relative overflow-hidden rounded-2xl border border-border/40 bg-card/60 px-5 py-10 text-center shadow-sm backdrop-blur-sm sm:px-10 sm:py-14">
          <HeroGlow />
          <CardEyebrow className="hero-reveal text-center" style={{ animationDelay: '60ms' }}>
            {t('home.welcome')}
          </CardEyebrow>
          <h1 className="hero-reveal mx-auto mt-2 max-w-3xl text-3xl font-bold tracking-tight sm:text-5xl" style={{ animationDelay: '120ms' }}>
            <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              {branding.appName}
            </span>{' '}
            — {t('home.headline')}
          </h1>
          <p className="hero-reveal mx-auto mt-3 max-w-xl text-muted-foreground sm:text-lg" style={{ animationDelay: '180ms' }}>
            {t('home.subhead')}
          </p>
          <div className="hero-reveal mt-6 flex flex-wrap items-center justify-center gap-3" style={{ animationDelay: '240ms' }}>
            <Button asChild size="lg">
              <Link to="/book">
                {user ? t('home.bookNow') : t('home.signInToBook')} <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            {user && (
              <Button asChild variant="outline" size="lg">
                <Link to="/my-bookings">{t('home.myBookings')}</Link>
              </Button>
            )}
          </div>

          {/* Live stat strip — compact single line on phones, row on larger */}
          <div className="hero-reveal mx-auto mt-8 flex max-w-md items-center justify-center gap-x-4 gap-y-2 rounded-2xl border bg-card/70 px-4 py-3 text-sm shadow-sm backdrop-blur sm:flex-wrap sm:gap-x-5 sm:px-6 sm:py-4" style={{ animationDelay: '300ms' }}>
            <div className="text-left">
              <p className="flex items-center gap-1.5 text-xs uppercase tracking-wide text-muted-foreground">
                <span className="live-dot h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden="true" />
                {t('home.liveToday')}
              </p>
              <p className="mt-0.5 font-semibold">{format(startOfToday(), 'EEE, MMM d')}</p>
            </div>
            <span className="h-8 w-px bg-border" aria-hidden="true" />
            <div className="text-left">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">{t('home.bookable')}</p>
              <p className="mt-0.5 font-semibold">
                {isLoading ? '…' : t('home.resources', { count: activeCount })}
              </p>
            </div>
          {isAdmin && (
            <>
              <span className="h-8 w-px bg-border" aria-hidden="true" />
              <div className="text-left">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">{t('home.freeSlotsToday')}</p>
                <p className="mt-0.5 font-semibold">
                  {availabilityStatus === 'loading' ? '…' : availabilityStatus === 'ready' ? totalFreeToday : '—'}
                </p>
              </div>
            </>
          )}
        </div>
        </div>
      </section>

      {/* Bento grid */}
      <CardEyebrow className="mb-4 text-center">{t('home.whyBook')}</CardEyebrow>
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {/* Highlight tile — tinted, big KPI number + segmented progress */}
        <Card className="bg-primary/10 sm:col-span-2">
          <CardHeader className="flex-row items-center gap-3 space-y-0">
            <IconCircle icon={Sparkles} />
            <CardTitle className="text-lg font-bold">{t('home.liveBranded')}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="max-w-lg text-sm text-muted-foreground">{t('home.liveBrandedDesc')}</p>
            <div className="mt-4 flex items-baseline gap-2">
              {isLoading ? (
                <Skeleton className="h-10 w-14" aria-hidden="true" />
              ) : (
                <span className="text-4xl font-bold tracking-tight">{activeCount}</span>
              )}
              <span className="text-sm text-muted-foreground">{t('home.bookableNow', { count: activeCount })}</span>
            </div>
            <Segments filled={resources.length > 0 ? (activeCount / 3) * SEGMENTS : 0} />
          </CardContent>
        </Card>

        {features.map(({ icon, title, desc, tone }) => (
          <Card
            key={title}
            className={cn(
              'flex flex-col',
              tone === 'tint' && 'bg-accent/10',
              // The promo card stays dark in BOTH themes (like the sidebar) —
              // sidebar tokens are always the dark surface.
              tone === 'dark' && 'border-transparent bg-sidebar text-sidebar-foreground'
            )}
          >
            <CardHeader className="flex-row items-center gap-3 space-y-0">
              <IconCircle icon={icon} dark={tone === 'dark'} />
              <CardTitle className={cn('text-base', tone === 'dark' && 'text-sidebar-foreground')}>
                {title}
              </CardTitle>
            </CardHeader>
            <CardContent className="flex-1">
              <p className={cn('text-sm', tone === 'dark' ? 'text-sidebar-foreground/70' : 'text-muted-foreground')}>
                {desc}
              </p>
              {tone === 'dark' && canInstall && (
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-4 border-transparent bg-white text-sidebar hover:bg-white/90"
                  onClick={async () => {
                    const result = await install()
                    if (result === 'unavailable') setShowInstallHelp(true)
                  }}
                >
                  <Smartphone className="h-4 w-4" /> {t('home.addToHome')}
                </Button>
              )}
            </CardContent>
          </Card>
        ))}

        {/* Resources tile — reference-style recommended grid */}
        <Card className="sm:col-span-2 lg:col-span-3">
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle className="text-lg font-bold">{t('home.whatYouCanBook')}</CardTitle>
            {!isLoading && resources.length > 0 && (
              <Link to="/book" className="flex items-center gap-1 text-xs font-semibold text-primary hover:underline">
                {t('home.bookNow')} <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            )}
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <ResourceCardsSkeleton />
            ) : resources.length === 0 ? (
              <EmptyState
                compact
                icon={CalendarCheck2}
                title={t('home.noResources')}
                description={t('home.noResourcesDesc')}
              />
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {resources.map((r, i) => {
                  const Icon = /projector|screen|presentation/i.test(r.name)
                    ? Presentation
                    : /room|conference|huddle|meeting/i.test(r.name)
                      ? DoorOpen
                      : CalendarCheck2
                  return (
                    <Link
                      key={r.id}
                      to={`/book?resource=${r.id}`}
                      className="lift-hover group block rounded-2xl bg-muted/40 p-6 text-center transition-colors hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <span
                        className={cn(
                          'mx-auto flex h-12 w-12 items-center justify-center rounded-full shadow-sm transition-colors group-hover:scale-105',
                          i % 2 === 0 ? 'bg-white text-primary' : 'bg-white text-accent-foreground'
                        )}
                      >
                        <Icon className="h-5 w-5" />
                      </span>
                      <h3 className="mt-3 font-semibold transition-colors group-hover:text-primary">{r.name}</h3>
                      {r.description && <p className="mt-1 text-sm text-muted-foreground">{r.description}</p>}
                      <div className="mt-4 flex items-center justify-center">
                        <AvailabilityPill count={availability[r.id]} status={availabilityStatus} />
                      </div>
                    </Link>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      {/* Quick actions — shortcut cards for signed-in users (and admins) */}
      {user && (
        <section className="mt-10">
          <CardEyebrow className="mb-4 text-center">{t('home.quickActions')}</CardEyebrow>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Link
              to="/my-bookings"
              className="lift-hover group flex items-center gap-3 rounded-2xl bg-muted/40 p-5 transition-colors hover:bg-primary/10"
            >
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white text-primary shadow-sm dark:bg-secondary">
                <CalendarCheck2 className="h-5 w-5" />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold">{t('home.quickBookings')}</span>
                <span className="block truncate text-xs text-muted-foreground">{t('home.quickBookingsDesc')}</span>
              </span>
            </Link>

            <button
              type="button"
              onClick={async () => {
                hapticTap()
                const result = await install()
                if (result === 'unavailable') setShowInstallHelp(true)
              }}
              className="lift-hover group flex items-center gap-3 rounded-2xl bg-muted/40 p-5 text-left transition-colors hover:bg-primary/10"
            >
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white text-primary shadow-sm dark:bg-secondary">
                <Smartphone className="h-5 w-5" />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold">{t('home.quickInstall')}</span>
                <span className="block truncate text-xs text-muted-foreground">{t('home.quickInstallDesc')}</span>
              </span>
            </button>

            {isAdmin ? (
              <Link
                to="/admin"
                className="lift-hover group flex items-center gap-3 rounded-2xl bg-muted/40 p-5 transition-colors hover:bg-primary/10"
              >
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white text-primary shadow-sm dark:bg-secondary">
                  <ShieldCheck className="h-5 w-5" />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold">{t('home.quickAdmin')}</span>
                  <span className="block truncate text-xs text-muted-foreground">{t('home.quickAdminDesc')}</span>
                </span>
              </Link>
            ) : (
              <Link
                to="/book"
                className="lift-hover group flex items-center gap-3 rounded-2xl bg-muted/40 p-5 transition-colors hover:bg-primary/10"
              >
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white text-primary shadow-sm dark:bg-secondary">
                  <CalendarCheck2 className="h-5 w-5" />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold">{t('home.quickBook')}</span>
                  <span className="block truncate text-xs text-muted-foreground">{t('home.quickBookDesc')}</span>
                </span>
              </Link>
            )}
          </div>
        </section>
      )}

      <InstallAppDialog
        open={showInstallHelp}
        onOpenChange={setShowInstallHelp}
        isIOS={isIOS}
        appName={branding.appName || 'this app'}
      />
    </main>
  )
}
