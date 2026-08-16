import { useEffect, useMemo, useRef } from 'react'
import { DayPicker, type DayContentProps } from 'react-day-picker'
import { addDays, startOfToday } from 'date-fns'

import { useResourceBookings } from '@/hooks/useBookings'
import { useAnnouncements, closureRangesFor } from '@/hooks/useAnnouncements'
import { useSettings } from '@/contexts/SettingsContext'
import { buildTimeSlots } from '@/lib/timeSlots'
import { useBookingFlowStore } from '@/stores/useBookingFlowStore'
import { useI18n } from '@/lib/i18n'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

interface BookingCalendarProps {
  resourceId: string
}

/** Respect the OS "reduce motion" setting for the auto-scroll. */
function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
}

/**
 * Manually animate the window scroll to a target Y.
 * Native smooth scrollIntoView/scrollTo can be flaky in embedded webviews
 * (cancelled mid-animation), so we drive the animation ourselves with an
 * ease-out curve. Reduced motion → instant jump (WCAG 2.3.3).
 */
function animateScrollTo(targetY: number, duration = 320) {
  const startY = window.scrollY
  const delta = targetY - startY
  if (Math.abs(delta) < 1) return
  if (prefersReducedMotion()) {
    window.scrollTo(0, targetY)
    return
  }
  const start = performance.now()
  const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3)
  const step = (now: number) => {
    const t = Math.min(1, (now - start) / duration)
    window.scrollTo(0, startY + delta * easeOutCubic(t))
    if (t < 1) requestAnimationFrame(step)
  }
  requestAnimationFrame(step)
}

/**
 * BookingCalendar — month view of a resource's availability.
 * - Each day shows a small pill with the number of free slots (0 = none).
 * - Days with no free slot are disabled (can't be picked).
 * - Picking a day auto-scrolls to its time slots and shows the count.
 * The DB atomic slot doc is the real anti-double-booking guarantee; this is
 * the UX layer on top.
 */
export function BookingCalendar({ resourceId }: BookingCalendarProps) {
  const { data: bookings = [], isLoading } = useResourceBookings(resourceId)
  const { data: announcements = [] } = useAnnouncements()
  const { bookingConfig } = useSettings()
  const { date, startTime, setDate, setSlot, setStep } = useBookingFlowStore()
  const { t } = useI18n()
  const slotsRef = useRef<HTMLDivElement>(null)

  const today = startOfToday()

  // Scheduled closures (date ranges from announcements) block those days.
  const closureRanges = useMemo(() => closureRangesFor(announcements), [announcements])
  const slotConfig = useMemo(
    () => ({ ...bookingConfig, closedRanges: closureRanges }),
    [bookingConfig, closureRanges]
  )

  // Map of dayKey (toDateString) -> booked intervals
  const bookingsByDay = useMemo(() => {
    const map = new Map<string, { start_time: string; end_time: string; status: string }[]>()
    for (const b of bookings) {
      if (b.status === 'cancelled') continue
      const key = new Date(b.start_time).toDateString()
      const arr = map.get(key) ?? []
      arr.push({ start_time: b.start_time, end_time: b.end_time, status: b.status })
      map.set(key, arr)
    }
    return map
  }, [bookings])

  // Per-day: free-slot count (drives the pills), days with free slots
  // (custom "available" modifier) and days that are fully booked / past
  // (disabled). While bookings are still loading we keep everything neutral
  // so the calendar doesn't flash "fully booked" then flip.
  const { freeCounts, availableDays, disabledDays } = useMemo(() => {
    const freeCounts = new Map<string, number>()
    const available: Date[] = []
    const disabled: Date[] = []
    if (!isLoading) {
      const from = new Date(today)
      const to = addDays(today, 90) // limit picker to 90 days out
      for (let d = new Date(from); d <= to; d.setDate(d.getDate() + 1)) {
        const existing = bookingsByDay.get(d.toDateString()) ?? []
        const slots = buildTimeSlots(d, existing, slotConfig)
        const free = slots.filter((s) => !s.taken).length
        if (free > 0) {
          freeCounts.set(d.toDateString(), free)
          available.push(new Date(d))
        } else {
          disabled.push(new Date(d))
        }
      }
    }
    return { freeCounts, availableDays: available, disabledDays: disabled }
  }, [bookingsByDay, today, isLoading, slotConfig])

  // Auto-scroll to the slots section when a day is picked — mobile users
  // don't have to hunt for it below the calendar.
  useEffect(() => {
    if (!date || !slotsRef.current) return
    const y = slotsRef.current.getBoundingClientRect().top + window.scrollY - 16
    animateScrollTo(y)
  }, [date])

  const selectedDayBookings = date ? bookingsByDay.get(date.toDateString()) ?? [] : []
  const slots = date ? buildTimeSlots(date, selectedDayBookings, slotConfig) : []
  const freeCount = date ? freeCounts.get(date.toDateString()) ?? 0 : 0

  // ── Quick date chips (Today / Tomorrow / This weekend) ────────────────────
  // Candidates are computed from `today`; the weekend chip resolves to the
  // first Sat/Sun (relative to today) that still has free slots.
  const weekendCandidates = useMemo(() => {
    const dow = today.getDay() // 0=Sun … 6=Sat
    // On Saturday the weekend is just tomorrow (Sunday) — don't duplicate the
    // "Tomorrow" chip with another Saturday option.
    if (dow === 6) return [addDays(today, 1)]
    if (dow === 0) return [new Date(today)]
    const toSat = (6 - dow) % 7
    return [addDays(today, toSat), addDays(today, toSat + 1)]
  }, [today])

  const quickChips = useMemo(() => {
    const tomorrow = addDays(today, 1)
    const weekendDay = weekendCandidates.find((d) => freeCounts.has(d.toDateString()))
    return [
      { key: 'today', label: t('cal.today'), date: new Date(today), available: freeCounts.has(today.toDateString()) },
      { key: 'tomorrow', label: t('cal.tomorrow'), date: tomorrow, available: freeCounts.has(tomorrow.toDateString()) },
      { key: 'weekend', label: t('cal.weekend'), date: weekendDay ?? weekendCandidates[0], available: !!weekendDay },
    ]
  }, [today, weekendCandidates, freeCounts, t])

  return (
    <div className="space-y-4">
      {/* Quick picks — one tap instead of hunting through the month grid */}
      <div className="flex flex-wrap gap-2">
        {quickChips.map((chip) => {
          const isSelected = !!date && chip.date.toDateString() === date.toDateString()
          return (
            <Button
              key={chip.key}
              type="button"
              size="sm"
              variant={isSelected ? 'default' : 'outline'}
              disabled={isLoading || !chip.available}                  className={cn('h-11 rounded-full px-3 text-xs font-semibold')}
              onClick={() => {
                setDate(chip.date)
                setSlot('', '')
              }}
            >
              {chip.label}
              <span className={cn('ml-1 text-[10px] font-normal', isSelected ? 'text-primary-foreground/80' : 'text-muted-foreground')}>
                {chip.date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
              </span>
            </Button>
          )
        })}
      </div>

      <DayPicker
        mode="single"
        selected={date ?? undefined}
        onSelect={(d) => {
          if (d) {
            setDate(d)
            setSlot('', '')
          }
        }}
        disabled={[{ before: today }, ...disabledDays]}
        fromDate={today}
        toDate={addDays(today, 90)}
        showOutsideDays
        modifiers={{ available: availableDays }}
        components={{
          DayContent: ({ date: dayDate, activeModifiers }: DayContentProps) => {
            const count = activeModifiers.available
              ? freeCounts.get(dayDate.toDateString()) ?? 0
              : 0
            return (
              <div className="rdp-day_content flex h-full w-full flex-col items-center justify-center gap-0.5">
                <span className="leading-none">{dayDate.getDate()}</span>
                {/* Slot-count pill — invisible spacer keeps all rows equal height */}
                <span
                  className={cn(
                    'flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1 text-[10px] font-bold leading-none',
                    count > 0 ? 'bg-primary/15 text-primary' : 'bg-transparent'
                  )}
                >
                  {count > 0 ? count : ''}
                </span>
              </div>
            )
          },
        }}
      />

      {/* Legend */}
      <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-primary/15 px-1 text-[10px] font-bold text-primary">
            6
          </span>
          {t('cal.legendFree')}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-3.5 w-3.5 rounded-full border border-dashed border-muted-foreground/50" />
          {t('cal.legendBooked')}
        </span>
      </div>

      {date && (
        <div ref={slotsRef} className="scroll-mt-24">
          <h3 className="mb-2 text-sm font-semibold">
            {freeCount > 0
              ? `${t('cal.slotsAvailable', { count: freeCount })} · `
              : `${t('cal.noSlots')} · `}
            {date.toLocaleDateString(undefined, {
              weekday: 'short',
              month: 'short',
              day: 'numeric',
            })}
          </h3>
          {isLoading ? (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3" aria-hidden="true">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-10 rounded-full" />
              ))}
            </div>
          ) : slots.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('cal.fullyBookedDay')}</p>
          ) : (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {slots.map((slot) => (
                <Button
                  key={slot.start}
                  type="button"
                  variant={startTime === slot.start ? 'default' : 'outline'}
                  disabled={slot.taken}
                  className={cn('h-11', slot.taken && 'opacity-40 line-through')}
                  onClick={() => {
                    setSlot(slot.start, slot.end)
                    setStep('review')
                  }}
                >
                  {slot.label}
                </Button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
