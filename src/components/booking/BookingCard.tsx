import { useState } from 'react'
import { useNavigate } from 'react-router'
import { CalendarClock, CalendarSync, MapPin, RotateCcw, XCircle } from 'lucide-react'
import { toast } from 'sonner'

import type { Booking } from '@/types/booking.types'
import { useCancelBooking } from '@/hooks/useBookings'
import { useI18n, tr } from '@/lib/i18n'
import { BookingStatusBadge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { formatDateTime } from '@/lib/timeSlots'
import { hapticWarning } from '@/lib/haptics'

const CANCELABLE: string[] = ['pending', 'confirmed']

export function BookingCard({ booking }: { booking: Booking }) {
  const cancelBooking = useCancelBooking()
  const { t } = useI18n()
  const navigate = useNavigate()
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [reschedOpen, setReschedOpen] = useState(false)

  const handleCancel = async () => {
    try {
      await cancelBooking.mutateAsync({ id: booking.id })
      hapticWarning()
      toast.success(tr('card.cancelled'))
      setConfirmOpen(false)
    } catch {
      toast.error(tr('card.couldNotCancel'))
    }
  }

  /** One tap: cancel the current slot, then jump to the picker for the same
   *  resource (BookingForm pre-selects ?resource=<id> and starts fresh). */
  const handleReschedule = async () => {
    try {
      await cancelBooking.mutateAsync({ id: booking.id })
      hapticWarning()
      toast.success(tr('card.rescheduled'))
      setReschedOpen(false)
      if (booking.resource_id) navigate(`/book?resource=${booking.resource_id}`)
      else navigate('/book')
    } catch {
      toast.error(tr('card.couldNotCancel'))
    }
  }

  // Only pending/confirmed bookings that haven't started yet can be cancelled.
  const isUpcoming = new Date(booking.start_time).getTime() > Date.now()
  const cancellable = CANCELABLE.includes(booking.status) && isUpcoming

  return (
    <Card>
      <CardContent className="flex items-start justify-between gap-4 p-4">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="font-semibold">{booking.resource?.name ?? t('card.resource')}</span>
            <BookingStatusBadge status={booking.status} />
          </div>
          <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <CalendarClock className="h-4 w-4" />
            {formatDateTime(booking.start_time)} – {formatDateTime(booking.end_time)}
          </p>
          {booking.notes && (
            <p className="text-sm text-muted-foreground">
              <span className="font-medium">{t('card.note')}</span> {booking.notes}
            </p>
          )}
          {booking.user?.full_name && (
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <MapPin className="h-3.5 w-3.5" />
              {booking.user.full_name}
            </p>
          )}
        </div>
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
          {/* Past / cancelled bookings can be rebooked in one tap */}
          {!isUpcoming && booking.resource_id && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate(`/book?resource=${booking.resource_id}`)}
            >
              <RotateCcw className="h-4 w-4" />
              {t('card.bookAgain')}
            </Button>
          )}
          {cancellable && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setReschedOpen(true)}
                disabled={cancelBooking.isPending}
              >
                <CalendarSync className="h-4 w-4" />
                {t('card.reschedule')}
              </Button>
              <Button variant="outline" size="sm" onClick={() => setConfirmOpen(true)} disabled={cancelBooking.isPending}>
                <XCircle className="h-4 w-4" />
                {t('card.cancel')}
              </Button>
            </>
          )}
        </div>
      </CardContent>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={t('card.cancelTitle')}
        description={t('card.cancelDesc', { name: booking.resource?.name ?? t('card.resource'), when: formatDateTime(booking.start_time) })}
        confirmLabel={t('card.cancelBooking')}
        loading={cancelBooking.isPending}
        onConfirm={() => void handleCancel()}
      />

      <ConfirmDialog
        open={reschedOpen}
        onOpenChange={setReschedOpen}
        title={t('card.reschedTitle')}
        description={t('card.reschedDesc', { name: booking.resource?.name ?? t('card.resource'), when: formatDateTime(booking.start_time) })}
        confirmLabel={t('card.reschedCancel')}
        loading={cancelBooking.isPending}
        onConfirm={() => void handleReschedule()}
      />
    </Card>
  )
}
