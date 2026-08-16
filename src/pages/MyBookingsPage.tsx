import { useState } from 'react'
import { Link } from 'react-router'
import { CalendarCheck2, CalendarX2, Plus, Search, SearchX } from 'lucide-react'

import { useBookings } from '@/hooks/useBookings'
import { usePullToRefresh, PullIndicator } from '@/hooks/usePullToRefresh'
import { BookingList } from '@/components/booking/BookingList'
import { useI18n } from '@/lib/i18n'
import { PageHero } from '@/components/layout/PageHero'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardEyebrow, CardHeader, CardTitle } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { formatDateTime } from '@/lib/timeSlots'
import type { Booking, BookingStatus } from '@/types/booking.types'

const STATUS_OPTIONS: Array<BookingStatus | 'all'> = ['all', 'pending', 'confirmed', 'cancelled', 'completed']

export function MyBookingsPage() {
  const { data: bookings, isLoading, isError, refetch } = useBookings()
  const { t } = useI18n()
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<BookingStatus | 'all'>('all')
  const { pull, refreshing, handlers } = usePullToRefresh(() => refetch())

  const matches = (b: Booking) => {
    if (statusFilter !== 'all' && b.status !== statusFilter) return false
    const q = query.trim().toLowerCase()
    if (q) {
      const haystack =
        `${b.resource?.name ?? ''} ${formatDateTime(b.start_time)} ${b.status}`.toLowerCase()
      if (!haystack.includes(q)) return false
    }
    return true
  }

  const filtered = (bookings ?? []).filter(matches)
  const hasFilter = query.trim() !== '' || statusFilter !== 'all'

  const upcoming = filtered.filter(
    (b) => b.status !== 'cancelled' && new Date(b.start_time) >= new Date()
  )
  const history = filtered.filter(
    (b) => b.status === 'cancelled' || new Date(b.start_time) < new Date()
  )

  const stats = [
    { label: t('my.upcoming'), value: upcoming.length, icon: CalendarCheck2 },
    { label: t('my.pastCancelled'), value: history.length, icon: CalendarX2 },
    { label: t('my.total'), value: filtered.length },
  ]

  return (
    <main className="mx-auto max-w-5xl px-4 py-10" {...handlers}>
      {/* Pull-to-refresh indicator — native-app feel on touch phones */}
      <PullIndicator pull={pull} refreshing={refreshing} />
      {/* Page header — same hero treatment as the Home page */}
      <PageHero
        eyebrow={t('my.eyebrow')}
        title={t('my.title')}
        action={
          <Button asChild>
            <Link to="/book">
              <Plus className="h-4 w-4" /> {t('my.newBooking')}
            </Link>
          </Button>
        }
      />

      {/* Stat pills — single-line scrollable strip on phones (native-app
          feel), wrapping normally on larger screens. */}
      <div className="mb-6 flex gap-2 overflow-x-auto pb-1 sm:flex-wrap sm:overflow-visible sm:pb-0">
        {isLoading ? (
          <div className="flex gap-2" aria-hidden="true">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-9 w-40 shrink-0 rounded-full" />
            ))}
          </div>
        ) : (
          stats.map(({ label, value, icon: Icon }) => (
            <span
              key={label}
              className="flex shrink-0 items-center gap-2 rounded-full bg-card px-4 py-2 text-sm shadow-sm"
            >
              {Icon && <Icon className="h-4 w-4 text-muted-foreground" />}
              <span className="whitespace-nowrap text-muted-foreground">{label}</span>
              <span className="font-bold">{value}</span>
            </span>
          ))
        )}
      </div>

      {/* Search + filter toolbar */}
      <div className="mb-6 flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder={t('my.searchPlaceholder')}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label={t('my.searchLabel')}
          />
        </div>
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as BookingStatus | 'all')}>
          <SelectTrigger className="w-full sm:w-44" aria-label={t('my.filterLabel')}>
            <SelectValue placeholder={t('common.status')} />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((s) => (
              <SelectItem key={s} value={s}>
                {s === 'all' ? t('status.all') : t(`status.${s}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {!isLoading && hasFilter && filtered.length === 0 ? (
        <EmptyState
          icon={SearchX}
          title={t('my.noMatch')}
          description={t('my.noMatchDesc')}
          action={
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setQuery('')
                setStatusFilter('all')
              }}
            >
              {t('my.clearFilters')}
            </Button>
          }
          className="py-10"
        />
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <section>
            <CardEyebrow className="mb-3">{t('my.upcoming')}</CardEyebrow>
            <Card>
              <CardHeader>
                <CardTitle className="text-lg font-bold">{t('my.comingUp')}</CardTitle>
              </CardHeader>
              <CardContent>
                <BookingList
                  bookings={upcoming}
                  isLoading={isLoading}
                  isError={isError}
                  emptyTitle={t('my.noUpcoming')}
                  emptyDescription={t('my.noUpcomingDesc')}
                  emptyAction={
                    !hasFilter ? (
                      <Button asChild size="sm">
                        <Link to="/book">
                          <Plus className="h-4 w-4" /> {t('my.bookSlot')}
                        </Link>
                      </Button>
                    ) : undefined
                  }
                />
              </CardContent>
            </Card>
          </section>

          <section>
            <CardEyebrow className="mb-3">{t('my.history')}</CardEyebrow>
            <Card>
              <CardHeader>
                <CardTitle className="text-lg font-bold">{t('my.pastTitle')}</CardTitle>
              </CardHeader>
              <CardContent>
                <BookingList
                  bookings={history}
                  isLoading={isLoading}
                  isError={isError}
                  emptyTitle={t('my.nothingHere')}
                  emptyDescription={t('my.historyDesc')}
                />
              </CardContent>
            </Card>
          </section>
        </div>
      )}
    </main>
  )
}
