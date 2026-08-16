import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router'
import { toast } from 'sonner'
import { CalendarClock, Check, CheckCircle2, Download, Phone, Search, SearchX, Trash2, XCircle } from 'lucide-react'

import { useAllBookings, useDeleteBooking, useUpdateBookingStatus } from '@/hooks/useBookings'
import { useResources } from '@/hooks/useResources'
import { useI18n, tr } from '@/lib/i18n'
import type { Booking, BookingStatus } from '@/types/booking.types'
import { BookingStatusBadge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { formatDateTime } from '@/lib/timeSlots'
import { hapticSuccess } from '@/lib/haptics'
import { downloadCsv, todayStamp } from '@/lib/csv'

const STATUS_FILTERS: Array<BookingStatus | 'all'> = ['all', 'pending', 'confirmed', 'completed', 'cancelled']

function isStatus(v: string | null): v is BookingStatus {
  return v !== null && STATUS_FILTERS.slice(1).includes(v as BookingStatus)
}

/** Admin view of all bookings — search, filter, confirm, complete, cancel, delete.
 * Filters are synced to the URL (?status=…&resource=…) so the dashboard can
 * deep-link straight into a filtered list (e.g. "Pending approval"). */
export function BookingManager() {
  const { data: bookings = [], isLoading, isError } = useAllBookings()
  const { data: resources = [] } = useResources({ includeInactive: true })
  const { t } = useI18n()
  const updateStatus = useUpdateBookingStatus()
  const deleteBooking = useDeleteBooking()
  const [searchParams, setSearchParams] = useSearchParams()
  const [query, setQuery] = useState('')
  const [resourceFilter, setResourceFilter] = useState(
    () => searchParams.get('resource') ?? 'all'
  )
  const [filter, setFilter] = useState<BookingStatus | 'all'>(
    () => {
      const s = searchParams.get('status')
      return isStatus(s) ? s : 'all'
    }
  )

  // Keep the URL in sync so dashboard deep-links stay accurate & shareable.
  useEffect(() => {
    const next = new URLSearchParams()
    if (filter !== 'all') next.set('status', filter)
    if (resourceFilter !== 'all') next.set('resource', resourceFilter)
    setSearchParams(next, { replace: true })
  }, [filter, resourceFilter, setSearchParams])

  const visible = bookings.filter((b) => {
    if (filter !== 'all' && b.status !== filter) return false
    if (resourceFilter !== 'all' && b.resource_id !== resourceFilter) return false
    const q = query.trim().toLowerCase()
    if (q) {
      const haystack =
        `${b.resource?.name ?? ''} ${b.user?.full_name ?? ''} ${b.user?.phone ?? ''} ${b.user_id}`.toLowerCase()
      if (!haystack.includes(q)) return false
    }
    return true
  })

  const hasFilter = query.trim() !== '' || resourceFilter !== 'all' || filter !== 'all'

  const clearFilters = () => {
    setQuery('')
    setResourceFilter('all')
    setFilter('all')
  }

  /** Export the currently filtered rows as a CSV (respects search + filters). */
  const exportCsv = () => {
    const rows = visible.map((b) => [
      b.resource?.name ?? '',
      b.user?.full_name ?? '',
      b.user?.phone ?? '',
      b.status,
      formatDateTime(b.start_time),
      formatDateTime(b.end_time),
      b.notes ?? '',
    ])
    downloadCsv(`bookings-${todayStamp()}.csv`, [
      t('ab.csvResource'),
      t('ab.csvUser'),
      t('ab.csvPhone'),
      t('ab.csvStatus'),
      t('ab.csvStart'),
      t('ab.csvEnd'),
      t('ab.csvNotes'),
    ], rows)
    hapticSuccess()
    toast.success(tr('ab.exported', { count: visible.length }))
  }

  const handleStatus = async (b: Booking, status: BookingStatus) => {
    try {
      await updateStatus.mutateAsync({ id: b.id, status })
      hapticSuccess()
      toast.success(tr('ab.marked', { status: tr(`status.${status}`) }))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : tr('admin.updateFailed'))
    }
  }

  const [deleteTarget, setDeleteTarget] = useState<Booking | null>(null)

  const handleDelete = async (b: Booking) => {
    try {
      await deleteBooking.mutateAsync({ id: b.id })
      toast.success(tr('ab.deleted'))
      setDeleteTarget(null)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : tr('ab.deleteFailed'))
    }
  }

  if (isError) {
    return <p className="text-sm text-destructive">{t('ab.failedLoad')}</p>
  }

  /** Status action buttons — shared by the desktop table and mobile cards. */
  const renderActions = (b: Booking) => (
    <div className="flex flex-wrap justify-end gap-1">
      {b.status === 'pending' && (
        <Button variant="outline" size="sm" onClick={() => void handleStatus(b, 'confirmed')}>
          <Check className="h-4 w-4" /> {t('ab.confirm')}
        </Button>
      )}
      {b.status === 'confirmed' && (
        <Button variant="outline" size="sm" onClick={() => void handleStatus(b, 'completed')}>
          <CheckCircle2 className="h-4 w-4" /> {t('ab.complete')}
        </Button>
      )}
      {(b.status === 'pending' || b.status === 'confirmed') && (
        <Button variant="outline" size="sm" onClick={() => void handleStatus(b, 'cancelled')}>
          <XCircle className="h-4 w-4" /> {t('ab.cancel')}
        </Button>
      )}
      <Button variant="ghost" size="icon" onClick={() => setDeleteTarget(b)} aria-label={t('ab.deleteLabel')}>
        <Trash2 className="h-4 w-4 text-destructive" />
      </Button>
    </div>
  )

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder={t('ab.searchPlaceholder')}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label={t('ab.searchLabel')}
          />
        </div>
        <Select value={resourceFilter} onValueChange={setResourceFilter}>
          <SelectTrigger className="w-full sm:w-48" aria-label={t('ab.filterResource')}>
            <SelectValue placeholder={t('ab.resource')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('ab.allResources')}</SelectItem>
            {resources.map((r) => (
              <SelectItem key={r.id} value={r.id}>
                {r.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filter} onValueChange={(v) => setFilter(v as BookingStatus | 'all')}>
          <SelectTrigger className="w-full sm:w-40" aria-label={t('ab.filterStatus')}>
            <SelectValue placeholder={t('common.status')} />
          </SelectTrigger>
          <SelectContent>
            {STATUS_FILTERS.map((s) => (
              <SelectItem key={s} value={s}>
                {s === 'all' ? t('status.all') : t(`status.${s}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {isLoading ? t('common.loading') : t('ab.count', { count: visible.length })}
        </p>
        <div className="flex items-center gap-1">
          {hasFilter && (
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              {t('ab.clearFilters')}
            </Button>
          )}
          {!isLoading && visible.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={exportCsv}
              aria-label={t('ab.exportLabel')}
              title={t('ab.exportTitle')}
            >
              <Download className="h-4 w-4" />
              <span className="hidden sm:inline">{t('ab.export')}</span>
            </Button>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : visible.length === 0 ? (
        <EmptyState
          icon={hasFilter ? SearchX : CalendarClock}
          title={hasFilter ? t('ab.noMatch') : t('ab.noBookings')}
          description={hasFilter ? t('ab.noMatchDesc') : t('ab.noBookingsDesc')}
          className="py-10"
        />
      ) : (
        <>
          {/* Mobile: card list — no horizontal scroll needed (native-app feel) */}
          <div className="space-y-3 md:hidden">
            {visible.map((b) => (
              <div key={b.id} className="rounded-2xl border bg-card p-4 shadow-sm">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{b.resource?.name ?? '—'}</p>
                    <p className="mt-0.5 text-sm text-muted-foreground">
                      {b.user?.full_name ?? b.user_id.slice(0, 8)}
                    </p>
                    {b.user?.phone && (
                      <a
                        href={`tel:${b.user.phone.replace(/[^+\d]/g, '')}`}
                        className="mt-1 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary hover:underline"
                        title={t('admin.callCustomer')}
                      >
                        <Phone className="h-3 w-3" />
                        {b.user.phone}
                      </a>
                    )}
                  </div>
                  <BookingStatusBadge status={b.status} />
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  {formatDateTime(b.start_time)} – {formatDateTime(b.end_time)}
                </p>
                <div className="mt-3 border-t pt-3">{renderActions(b)}</div>
              </div>
            ))}
          </div>

          {/* Desktop: the original table (no mobile scroll needed) */}
          <div className="hidden rounded-lg border md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('ab.colResource')}</TableHead>
                  <TableHead>{t('ab.colUser')}</TableHead>
                  <TableHead>{t('ab.colWhen')}</TableHead>
                  <TableHead>{t('ab.colStatus')}</TableHead>
                  <TableHead className="text-right">{t('ab.colActions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visible.map((b) => (
                  <TableRow key={b.id}>
                    <TableCell className="font-medium">{b.resource?.name ?? '—'}</TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-0.5">
                        <span className="font-medium">{b.user?.full_name ?? b.user_id.slice(0, 8)}</span>
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
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {formatDateTime(b.start_time)} – {formatDateTime(b.end_time)}
                    </TableCell>
                    <TableCell>
                      <BookingStatusBadge status={b.status} />
                    </TableCell>
                    <TableCell className="text-right">{renderActions(b)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </>
      )}

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => { if (!open) setDeleteTarget(null) }}
        title={t('ab.deleteTitle')}
        description={t('ab.deleteDesc', { name: deleteTarget?.resource?.name ?? t('ab.resource'), when: deleteTarget ? formatDateTime(deleteTarget.start_time) : '' })}
        confirmLabel={t('ab.deleteBooking')}
        loading={deleteBooking.isPending}
        onConfirm={() => { if (deleteTarget) void handleDelete(deleteTarget) }}
      />
    </div>
  )
}
