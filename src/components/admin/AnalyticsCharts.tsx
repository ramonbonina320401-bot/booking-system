import { useMemo } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { BarChart3, PieChart as PieChartIcon } from 'lucide-react'

import { useI18n } from '@/lib/i18n'
import type { Booking, BookingStatus } from '@/types/booking.types'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { Skeleton } from '@/components/ui/skeleton'

const TOOLTIP_STYLE = {
  background: 'var(--app-card)',
  border: '1px solid var(--app-border)',
  borderRadius: 12,
  fontSize: 12,
  color: 'var(--app-foreground)',
} as const

const AXIS_TICK = { fill: 'var(--app-muted-foreground)', fontSize: 11 } as const

/**
 * Bar chart — bookings per day over the last 14 days, in the reference style:
 * rounded-top bars, dual series (confirmed = primary tint, pending = accent
 * tint), dot + label legend chips, and a dark pill value callout on the peak day.
 */
export function BookingsTrendChart({ bookings, loading = false }: { bookings: Booking[]; loading?: boolean }) {
  const { t } = useI18n()
  const data = useMemo(() => {
    const days: { label: string; confirmed: number; pending: number }[] = []
    for (let i = 13; i >= 0; i--) {
      const d = new Date()
      d.setDate(d.getDate() - i)
      d.setHours(0, 0, 0, 0)
      const key = d.toDateString()
      const dayBookings = bookings.filter((b) => new Date(b.start_time).toDateString() === key)
      days.push({
        label: d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
        confirmed: dayBookings.filter((b) => b.status === 'confirmed' || b.status === 'completed').length,
        pending: dayBookings.filter((b) => b.status === 'pending').length,
      })
    }
    return days
  }, [bookings])

  const total = data.reduce((sum, d) => sum + d.confirmed + d.pending, 0)
  const peak = data.reduce((a, b) => (a.confirmed + a.pending >= b.confirmed + b.pending ? a : b))

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0 pb-4">
        <div>
          <CardTitle className="text-lg font-bold">{t('admin.statistics')}</CardTitle>
          <CardDescription>
            {loading ? t('admin.loadingBookings') : t('admin.statisticsDesc', { count: total })}
          </CardDescription>
        </div>
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <span className="h-2.5 w-2.5 rounded-full bg-primary" aria-hidden="true" /> {t('admin.chartConfirmed')}
          </span>
          <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <span className="h-2.5 w-2.5 rounded-full bg-accent" aria-hidden="true" /> {t('admin.chartPending')}
          </span>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-4 py-4" aria-hidden="true">
            <div className="flex h-48 items-end gap-2">
              {Array.from({ length: 14 }).map((_, i) => (
                <Skeleton
                  key={i}
                  className="flex-1 rounded-t-lg"
                  style={{ height: `${25 + ((i * 37) % 60)}%` }}
                />
              ))}
            </div>
            <Skeleton className="h-3 w-32 rounded-full" />
          </div>
        ) : total === 0 ? (
          <EmptyState
            compact
            icon={BarChart3}
            title={t('admin.noBookings14')}
            description={t('admin.noBookings14Desc')}
          />
        ) : (
          <div className="relative h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} margin={{ top: 8, right: 8, left: -24, bottom: 0 }} barGap={2}>
                <CartesianGrid stroke="var(--app-border)" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="label" tick={AXIS_TICK} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                <YAxis tick={AXIS_TICK} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: 'color-mix(in srgb, var(--app-muted) 50%, transparent)' }} />
                <Bar dataKey="confirmed" name={t('admin.chartConfirmed')} fill="var(--app-primary)" radius={[6, 6, 0, 0]} maxBarSize={26} />
                <Bar dataKey="pending" name={t('admin.chartPending')} fill="var(--app-accent)" radius={[6, 6, 0, 0]} maxBarSize={26} />
              </BarChart>
            </ResponsiveContainer>
            {/* Dark pill callout on the peak day (reference style) */}
            <span className="pointer-events-none absolute right-1/2 top-0 -translate-y-1 rounded-full bg-foreground px-2.5 py-1 text-xs font-bold text-background shadow-sm">
              {peak.confirmed + peak.pending}
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

const STATUS_COLORS: Record<BookingStatus, string> = {
  pending: 'var(--app-accent)',
  confirmed: 'var(--app-primary)',
  completed: 'var(--app-success)',
  cancelled: 'var(--app-muted-foreground)',
}

/** Donut chart — booking status distribution. */
export function StatusDonutChart({ bookings, loading = false }: { bookings: Booking[]; loading?: boolean }) {
  const { t } = useI18n()
  const data = useMemo(() => {
    const counts: Record<string, number> = { pending: 0, confirmed: 0, completed: 0, cancelled: 0 }
    for (const b of bookings) counts[b.status] = (counts[b.status] ?? 0) + 1
    return (Object.keys(counts) as BookingStatus[])
      .filter((s) => counts[s] > 0)
      .map((s) => ({ name: s, value: counts[s], color: STATUS_COLORS[s] }))
  }, [bookings])

  const total = data.reduce((sum, d) => sum + d.value, 0)

  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="text-lg font-bold">{t('admin.statusBreakdown')}</CardTitle>
        <CardDescription>{loading ? t('admin.loadingBookings') : t('admin.totalCount', { count: total })}</CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex flex-col items-center gap-4 sm:flex-row" aria-hidden="true">
            <Skeleton className="h-44 w-44 shrink-0 rounded-full" />
            <div className="w-full space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-5 w-full rounded-full" />
              ))}
            </div>
          </div>
        ) : total === 0 ? (
          <EmptyState
            compact
            icon={PieChartIcon}
            title={t('admin.noBookingsYet2')}
            description={t('admin.noStatusDesc')}
          />
        ) : (
          <div className="flex flex-col items-center gap-4 sm:flex-row">
            <div className="h-44 w-44 shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={52}
                    outerRadius={78}
                    paddingAngle={3}
                    stroke="var(--app-card)"
                  >
                    {data.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={TOOLTIP_STYLE} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <ul className="w-full space-y-2">
              {data.map((d) => (
                <li key={d.name} className="flex items-center justify-between gap-3 text-sm">
                  <span className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: d.color }} aria-hidden="true" />
                    {t(`status.${d.name}`)}
                  </span>
                  <span className="font-semibold">{d.value}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
