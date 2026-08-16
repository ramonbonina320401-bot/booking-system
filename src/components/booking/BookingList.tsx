import * as React from 'react'
import { CalendarX2 } from 'lucide-react'

import type { Booking } from '@/types/booking.types'
import { BookingCard } from '@/components/booking/BookingCard'
import { useI18n } from '@/lib/i18n'
import { EmptyState } from '@/components/ui/empty-state'
import { Skeleton } from '@/components/ui/skeleton'

interface BookingListProps {
  bookings?: Booking[]
  isLoading: boolean
  isError: boolean
  /** Title shown when there are no bookings. */
  emptyTitle?: string
  /** Supporting line under the title. */
  emptyDescription?: string
  /** Optional CTA (e.g. "Book a slot"). */
  emptyAction?: React.ReactNode
}

export function BookingList({
  bookings = [],
  isLoading,
  isError,
  emptyTitle,
  emptyDescription,
  emptyAction,
}: BookingListProps) {
  const { t } = useI18n()
  const resolvedTitle = emptyTitle ?? t('my.nothingHere')

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-24 w-full rounded-xl" />
        ))}
      </div>
    )
  }

  if (isError) {
    return <p className="text-sm text-destructive">{t('my.failedLoad')}</p>
  }

  if (bookings.length === 0) {
    return (
      <EmptyState
        icon={CalendarX2}
        title={resolvedTitle}
        description={emptyDescription}
        action={emptyAction}
      />
    )
  }

  return (
    <div className="space-y-3">
      {bookings.map((b) => (
        <BookingCard key={b.id} booking={b} />
      ))}
    </div>
  )
}
