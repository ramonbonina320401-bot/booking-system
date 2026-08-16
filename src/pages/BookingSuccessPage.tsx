import { Link, useLocation } from 'react-router'
import { CalendarCheck2, PartyPopper, Plus, Ticket } from 'lucide-react'

import { useSettings } from '@/contexts/SettingsContext'
import { useI18n } from '@/lib/i18n'
import { Button } from '@/components/ui/button'
import { formatDateTime } from '@/lib/timeSlots'

export interface BookingSuccessState {
  resourceName?: string | null
  startTime?: string | null
  endTime?: string | null
}

/** Shown right after a booking is confirmed — a satisfying confirmation beat
 *  instead of dropping the user straight into the bookings list. */
export function BookingSuccessPage() {
  const { branding } = useSettings()
  const { t } = useI18n()
  const location = useLocation()
  const state = (location.state ?? {}) as BookingSuccessState

  return (
    <main className="mx-auto flex min-h-[70dvh] w-full max-w-md flex-col items-center justify-center px-4 py-10 text-center">
      {/* Animated checkmark burst */}
      <div className="relative mb-6">
        <span className="absolute inset-0 -z-10 animate-ping rounded-full bg-emerald-500/20" aria-hidden="true" />
        <span className="flex h-20 w-20 items-center justify-center rounded-full bg-emerald-500/10">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500 text-white shadow-lg">
            <PartyPopper className="h-7 w-7" />
          </span>
        </span>
      </div>

      <h1 className="text-2xl font-bold tracking-tight">{t('success.title')}</h1>
      <p className="mt-2 text-muted-foreground">{t('success.subtitle', { app: branding.appName })}</p>

      {state.resourceName && state.startTime && (
        <div className="mt-6 w-full space-y-2 rounded-2xl border bg-card/70 p-4 text-left text-sm">
          <div className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-2 text-muted-foreground">
              <CalendarCheck2 className="h-4 w-4 shrink-0" />
              {t('success.resource')}
            </span>
            <span className="font-semibold">{state.resourceName}</span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-2 text-muted-foreground">
              <Ticket className="h-4 w-4 shrink-0" />
              {t('success.when')}
            </span>
            <span className="font-semibold">
              {formatDateTime(state.startTime)}
              {state.endTime ? ` – ${formatDateTime(state.endTime)}` : ''}
            </span>
          </div>
        </div>
      )}

      <p className="mt-4 text-sm text-muted-foreground">{t('success.pendingNote')}</p>

      <div className="mt-8 flex w-full flex-col gap-2 sm:flex-row">
        <Button asChild className="flex-1">
          <Link to="/my-bookings">
            <Ticket className="h-4 w-4" /> {t('success.viewBookings')}
          </Link>
        </Button>
        <Button asChild variant="outline" className="flex-1">
          <Link to="/book">
            <Plus className="h-4 w-4" /> {t('success.bookAnother')}
          </Link>
        </Button>
      </div>
    </main>
  )
}
