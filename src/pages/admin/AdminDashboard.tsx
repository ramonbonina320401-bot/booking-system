import { useMemo } from 'react'
import { Link, useNavigate } from 'react-router'
import { toast } from 'sonner'
import {
  ArrowRight,
  CalendarCheck2,
  CalendarClock,
  Check,
  Phone,
  Settings2,
  TrendingDown,
  TrendingUp,
  Users,
  Wrench,
  XCircle,
} from 'lucide-react'

import { useAllBookings, useUpdateBookingStatus } from '@/hooks/useBookings'
import { useResources } from '@/hooks/useResources'
import { useI18n, tr } from '@/lib/i18n'
import { AdminHero } from '@/components/layout/AdminHero'
import type { Booking, BookingStatus } from '@/types/booking.types'
import { BookingsTrendChart, StatusDonutChart } from '@/components/admin/AnalyticsCharts'
import { BookingStatusBadge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { Skeleton } from '@/components/ui/skeleton'
import { formatDateTime } from '@/lib/timeSlots'
import { cn } from '@/lib/utils'

const DAY = 86_400_000
const SEGMENTS = 8

/** Segmented progress bar — the reference's discrete-block indicator. */
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

/** White icon circle — the reference's signature tile accent.
 * Dark mode: swaps to a neutral circle so the light icon stays visible. */
function IconCircle({ icon: Icon, dark = false }: { icon: typeof Users; dark?: boolean }) {
  return (
    <span
      className={cn(
        'flex h-10 w-10 shrink-0 items-center justify-center rounded-full shadow-sm',
        dark ? 'bg-white/15 text-white' : 'bg-white text-foreground dark:bg-secondary dark:text-foreground'
      )}
    >
      <Icon className="h-5 w-5" />
    </span>
  )
}

/** KPI tile in the reference style. When `to` is set it becomes a link so the
 * admin can jump straight to the matching filtered list. */
function KpiCard({
  icon: Icon,
  label,
  value,
  unit,
  badge,
  delta,
  loading,
  tone = 'white',
  progress,
  className,
  to,
}: {
  icon: typeof Users
  label: string
  value: number | string
  unit?: string
  badge?: React.ReactNode
  delta?: number
  loading?: boolean
  tone?: 'white' | 'tint' | 'muted' | 'dark'
  progress?: number
  className?: string
  to?: string
}) {
  // The dark tone uses sidebar tokens so it stays dark in BOTH themes —
  // exactly like the reference's promo card and our icon rail.
  const toneClass: Record<string, string> = {
    white: '',
    tint: 'bg-primary/10',
    muted: 'bg-muted',
    dark: 'bg-sidebar text-sidebar-foreground',
  }
  const { t } = useI18n()
  const dark = tone === 'dark'
  const up = (delta ?? 0) >= 0

  const content = (
    <Card className={cn(toneClass[tone], className)}>
      <CardContent className="p-6">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <IconCircle icon={Icon} dark={dark} />
            <p className={cn('text-sm font-medium', dark ? 'text-sidebar-foreground/70' : 'text-muted-foreground')}>
              {label}
            </p>
          </div>
          {badge}
        </div>
        <div className="mt-4 flex items-baseline gap-2">
          {loading ? (
            <Skeleton className="h-10 w-20" />
          ) : (
            <p className="text-4xl font-bold tracking-tight">{value}</p>
          )}
          {unit && (
            <span className={cn('text-sm', dark ? 'text-sidebar-foreground/60' : 'text-muted-foreground')}>
              {unit}
            </span>
          )}
        </div>
        {typeof delta === 'number' && (
          <p
            className={cn(
              'mt-1.5 flex items-center gap-1 text-xs font-semibold',
              dark ? 'text-sidebar-foreground/70' : up ? 'text-success-foreground' : 'text-destructive'
            )}
          >
            {up ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
            {up ? '+' : ''}
            {delta}% {t('admin.vsLast7')}
          </p>
        )}
        {typeof progress === 'number' && <Segments filled={progress} />}
      </CardContent>
    </Card>
  )

  if (to) {
    return (
      <Link
        to={to}
        className="block rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {content}
      </Link>
    )
  }
  return content
}

export function AdminDashboard() {
  const navigate = useNavigate()
  const { t } = useI18n()
  const { data: bookings = [], isLoading: loadingBookings } = useAllBookings()
  const { data: resources = [], isLoading: loadingResources } = useResources({ includeInactive: true })
  const updateStatus = useUpdateBookingStatus()

  const now = Date.now()
  const upcoming = bookings.filter((b) => new Date(b.start_time).getTime() > now && b.status !== 'cancelled')
  const pending = bookings.filter((b) => b.status === 'pending')

  const delta = useMemo(() => {
    const weekAgo = now - 7 * DAY
    const prevWeek = now - 14 * DAY
    const recent = bookings.filter((b) => {
      const t = Number(b.created_at)
      return !Number.isNaN(t) && t >= weekAgo
    }).length
    const previous = bookings.filter((b) => {
      const t = Number(b.created_at)
      return !Number.isNaN(t) && t >= prevWeek && t < weekAgo
    }).length
    if (previous === 0) return recent > 0 ? 100 : 0
    return Math.round(((recent - previous) / previous) * 100)
  }, [bookings, now])

  const nextBooking = upcoming.sort((a, b) => a.start_time.localeCompare(b.start_time))[0]

  const activeResources = resources.filter((r) => r.is_active)
  const resourceProgress = resources.length > 0 ? (activeResources.length / resources.length) * SEGMENTS : 0

  const quickActions = [
    { to: '/admin/bookings', label: t('admin.manageBookings'), desc: t('admin.manageBookingsDesc'), icon: CalendarCheck2 },
    { to: '/admin/resources', label: t('nav.resources'), desc: t('admin.resourcesDesc'), icon: Wrench },
    { to: '/admin/settings', label: t('nav.settings'), desc: t('admin.settingsDesc'), icon: Settings2 },
  ]

  // "Recent" = newest created first. created_at is stored as a number; sort
  // numerically (lexicographic string sort scrambled the list and buried
  // brand-new bookings under old seed rows with the same timestamp).
  const recent = [...bookings]
    .sort((a, b) => {
      const ta = Number(a.created_at)
      const tb = Number(b.created_at)
      if (!Number.isNaN(ta) && !Number.isNaN(tb) && ta !== tb) return tb - ta
      return b.start_time.localeCompare(a.start_time)
    })
    .slice(0, 6)

  const handleStatus = async (b: Booking, status: BookingStatus) => {
    try {
      await updateStatus.mutateAsync({ id: b.id, status })
      toast.success(tr('admin.marked', { status: tr(`status.${status}`) }))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : tr('admin.updateFailed'))
    }
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      {/* Page header */}
      <AdminHero
        eyebrow={t('admin.overview')}
        title={t('admin.title')}
        subtitle={t('admin.subtitle')}
        actions={nextBooking ? (
          <Link
            to={nextBooking.status === 'pending' ? '/admin/bookings?status=pending' : '/admin/bookings'}
            className="lift-hover flex items-center gap-2 rounded-full bg-card px-4 py-2 text-sm shadow-sm transition-colors hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span className="text-muted-foreground">{t('admin.next')}</span>
            <span className="font-semibold">{nextBooking.resource?.name ?? '—'}</span>
            <span className="text-muted-foreground">·</span>
            <span>{formatDateTime(nextBooking.start_time)}</span>
            {nextBooking.status === 'pending' && (
              <span className="rounded-full bg-accent px-2 py-0.5 text-[10px] font-bold uppercase text-accent-foreground">
                {t('admin.pending')}
              </span>
            )}
            <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
          </Link>
        ) : undefined}
      />

      {/* KPI row — every tile links to the matching list */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          to="/admin/bookings"
          icon={CalendarCheck2}
          label={t('admin.totalBookings')}
          value={loadingBookings ? '—' : bookings.length}
          badge={
            typeof delta === 'number' ? (
              <span
                className={cn(
                  'rounded-full px-2.5 py-1 text-xs font-bold',
                  delta >= 0 ? 'bg-sidebar text-sidebar-foreground' : 'bg-destructive text-destructive-foreground'
                )}
              >
                {delta >= 0 ? '+' : ''}
                {delta}%
              </span>
            ) : undefined
          }
          loading={loadingBookings}
        />
        <KpiCard
          to="/admin/bookings"
          icon={CalendarClock}
          label={t('admin.upcoming')}
          value={upcoming.length}
          tone="muted"
          loading={loadingBookings}
          badge={
            <span className="rounded-full bg-sidebar px-2.5 py-1 text-xs font-bold text-sidebar-foreground">
              {t('admin.scheduled')}
            </span>
          }
        />
        <KpiCard
          to="/admin/bookings?status=pending"
          icon={Users}
          label={t('admin.pendingApproval')}
          value={pending.length}
          tone="dark"
          loading={loadingBookings}
          badge={
            <span className="rounded-full bg-accent px-2.5 py-1 text-xs font-bold text-accent-foreground">
              {t('admin.actionNeeded')}
            </span>
          }
        />
        <KpiCard
          to="/admin/resources"
          icon={Wrench}
          label={t('nav.resources')}
          value={resources.length}
          unit={t('admin.active', { count: activeResources.length })}
          tone="tint"
          loading={loadingResources}
          progress={resourceProgress}
        />
      </div>

      {/* Pending approvals — direct confirm/decline without leaving the page */}
      {pending.length > 0 && (
        <Card className="border-accent/50">
          <CardHeader className="flex-row items-center justify-between space-y-0 pb-4">
            <CardTitle className="text-lg font-bold">{t('admin.pendingApprovals')}</CardTitle>
            <span className="rounded-full bg-accent px-2.5 py-1 text-xs font-bold text-accent-foreground">
              {t('admin.needAction', { count: pending.length })}
            </span>
          </CardHeader>
          <CardContent className="space-y-2.5">
            {pending.slice(0, 5).map((b) => (
              <div
                key={b.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-muted/60 px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{b.resource?.name ?? '—'}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {b.user?.full_name ?? '—'} · {formatDateTime(b.start_time)}
                  </p>
                  {b.user?.phone ? (
                    <a
                      href={`tel:${b.user.phone.replace(/[^+\d]/g, '')}`}
                      className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary hover:underline"
                      title={t('admin.callCustomer')}
                    >
                      <Phone className="h-3 w-3" />
                      {b.user.phone}
                    </a>
                  ) : null}
                </div>
                <div className="flex shrink-0 gap-2">
                  <Button size="sm" onClick={() => void handleStatus(b, 'confirmed')} disabled={updateStatus.isPending}>
                    <Check className="h-4 w-4" /> {t('admin.confirm')}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => void handleStatus(b, 'cancelled')}
                    disabled={updateStatus.isPending}
                  >
                    <XCircle className="h-4 w-4" /> {t('admin.decline')}
                  </Button>
                </div>
              </div>
            ))}
            {pending.length > 5 && (
              <Link
                to="/admin/bookings?status=pending"
                className="block pt-1 text-center text-xs font-semibold text-primary hover:underline"
              >
                {t('admin.viewAllPending', { count: pending.length })}
              </Link>
            )}
          </CardContent>
        </Card>
      )}

      {/* Charts — click through to the full bookings list */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Link
          to="/admin/bookings"
          className="block xl:col-span-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <BookingsTrendChart bookings={bookings} loading={loadingBookings} />
        </Link>
        <Link to="/admin/bookings" className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <StatusDonutChart bookings={bookings} loading={loadingBookings} />
        </Link>
      </div>

      {/* Recent + quick actions */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader className="flex-row items-center justify-between space-y-0 pb-4">
            <CardTitle className="text-lg font-bold">{t('admin.recentBookings')}</CardTitle>
            <Link to="/admin/bookings" className="flex items-center gap-1 text-xs font-semibold text-primary hover:underline">
              {t('admin.viewAll')} <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </CardHeader>
          <CardContent className="space-y-2.5">
            {loadingBookings ? (
              <div className="space-y-2.5">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-14 w-full rounded-2xl" />
                ))}
              </div>
            ) : recent.length === 0 ? (
              <EmptyState
                compact
                icon={CalendarCheck2}
                title={t('admin.noBookingsYet')}
                description={t('admin.noBookingsDesc')}
                action={
                  <Button asChild size="sm" variant="outline">
                    <Link to="/admin/bookings">{t('admin.viewBookings')}</Link>
                  </Button>
                }
              />
            ) : (
              recent.map((b) => {
                const openBookings = (e?: React.MouseEvent | React.KeyboardEvent) => {
                  if (e) e.preventDefault()
                  void navigate(`/admin/bookings?status=${b.status}`)
                }
                return (
                  <div
                    key={b.id}
                    role="link"
                    tabIndex={0}
                    onClick={openBookings}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        openBookings()
                      }
                    }}
                    className="flex cursor-pointer items-center justify-between gap-4 rounded-2xl bg-muted/60 px-4 py-3 transition-colors hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{b.resource?.name ?? '—'}</p>
                      <p className="truncate text-xs text-muted-foreground">{b.user?.full_name ?? '—'}</p>
                      {b.user?.phone ? (
                        <p className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Phone className="h-3 w-3" />
                          <a
                            href={`tel:${b.user.phone.replace(/[^+\d]/g, '')}`}
                            className="hover:text-primary hover:underline"
                            title={t('admin.callCustomer')}
                            onClick={(e) => e.stopPropagation()}
                          >
                            {b.user.phone}
                          </a>
                        </p>
                      ) : null}
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      <span className="hidden text-xs font-medium text-muted-foreground sm:block">
                        {formatDateTime(b.start_time)}
                      </span>
                      <BookingStatusBadge status={b.status} />
                    </div>
                  </div>
                )
              })
            )}
          </CardContent>
        </Card>

        {/* Quick actions */}
        <Card className="flex flex-col">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg font-bold">{t('admin.quickActions')}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-1 flex-col gap-2.5">
            {quickActions.map(({ to, label, desc, icon: Icon }) => (
              <Link
                key={to}
                to={to}
                className="lift-hover group flex items-center gap-3 rounded-2xl bg-muted/60 px-4 py-3.5 transition-colors hover:bg-primary/10"
              >
                <IconCircle icon={Icon} />
                <span className="min-w-0">
                  <span className="block text-sm font-semibold">{label}</span>
                  <span className="block truncate text-xs text-muted-foreground">{desc}</span>
                </span>
              </Link>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
