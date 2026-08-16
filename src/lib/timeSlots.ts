/**
 * Time-slot helpers for the booking flow.
 *
 * Slots are computed from a resource's existing bookings for a given day.
 * The database enforces "no overlap" via the atomic slot doc; this client
 * logic is a UX convenience on top (the DB is the source of truth).
 *
 * The bookable window (open/close hour) and slot length come from
 * system_settings (`booking_open_hour`, `booking_close_hour`,
 * `slot_duration_minutes`) so admins can change them without redeploying —
 * the constants below are just the fallback defaults.
 */
import { format } from 'date-fns'

export const SLOT_HOURS = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17] as const
export const SLOT_DURATION_MINUTES = 60

export interface SlotConfig {
  /** First bookable hour of the day (0–23). Default 8. */
  openHour?: number
  /** First hour AFTER the last bookable hour (1–24). Default 18 (8AM–6PM). */
  closeHour?: number
  /** Slot length in minutes (15–240). Default 60. */
  durationMinutes?: number
  /** Weekday numbers (0=Sun … 6=Sat) with NO bookable slots. */
  closedDays?: number[]
  /** Inclusive date ranges (YYYY-MM-DD) with NO bookable slots — scheduled closures. */
  closedRanges?: { start: string; end: string }[]
}

export interface TimeSlot {
  /** Display label, e.g. "8:00 AM – 9:00 AM" */
  label: string
  /** ISO start datetime (local) */
  start: string
  /** ISO end datetime (local) */
  end: string
  /** True if this slot overlaps an existing (non-cancelled) booking */
  taken: boolean
}

interface ExistingBooking {
  start_time: string
  end_time: string
  status: string
}

/**
 * Build slots for `date` (a Date at midnight local) between the configured
 * open/close hours, and mark the ones that overlap existing bookings for the
 * same resource. Falls back to the legacy defaults (8AM–6PM, hourly) when no
 * config is passed (or the values are out of range).
 */
export function buildTimeSlots(
  date: Date,
  existing: ExistingBooking[],
  config: SlotConfig = {}
): TimeSlot[] {
  // Closed weekday (0=Sun … 6=Sat) → no bookable slots that day.
  if (config.closedDays?.includes(date.getDay())) return []
  // Scheduled closure covering this date → no bookable slots.
  if (config.closedRanges && inClosedRange(date, config.closedRanges)) return []

  const openHour = clampInt(config.openHour, 0, 23, SLOT_HOURS[0])
  const closeHour = clampInt(config.closeHour, 1, 24, SLOT_HOURS[SLOT_HOURS.length - 1] + 1)
  const durationMinutes = clampInt(config.durationMinutes, 15, 240, SLOT_DURATION_MINUTES)

  const slots: TimeSlot[] = []
  for (let hour = openHour; hour < closeHour; hour += durationMinutes / 60) {
    const start = new Date(date)
    start.setHours(Math.floor(hour), Math.round((hour % 1) * 60), 0, 0)
    const end = new Date(start)
    end.setMinutes(end.getMinutes() + durationMinutes)
    // A slot must fit entirely inside the bookable window — a 90-minute slot
    // can't start at 4:30 PM when the window closes at 5:00 PM.
    if (end.getHours() + end.getMinutes() / 60 > closeHour) break

    const taken = existing.some((b) => {
      const bs = new Date(b.start_time)
      const be = new Date(b.end_time)
      // overlap = existing starts before slot ends AND ends after slot starts
      return bs < end && be > start
    })

    slots.push({
      label: `${format(start, 'h:mm a')} – ${format(end, 'h:mm a')}`,
      start: start.toISOString(),
      end: end.toISOString(),
      taken,
    })
  }
  return slots
}

/** Local date as YYYY-MM-DD (calendar days are local, not UTC). */
function toDateKey(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** True if `date` falls inside any inclusive [start, end] range (YYYY-MM-DD). */
function inClosedRange(date: Date, ranges: { start: string; end: string }[]): boolean {
  const key = toDateKey(date)
  return ranges.some((r) => r.start <= key && key <= r.end)
}

/** Clamp an integer to [min, max]; fall back when missing/NaN/out of range. */
function clampInt(value: number | undefined, min: number, max: number, fallback: number): number {
  const n = Number(value)
  if (!Number.isFinite(n) || n < min || n > max) return fallback
  return Math.round(n)
}

/** Format a full timestamp for display, e.g. "Aug 12, 8:00 AM". */
export function formatDateTime(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return format(d, 'MMM d, h:mm a')
}

/** Format just the time part of an ISO slot start, e.g. "8:00 AM". */
export function formatTimeLabel(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return format(d, 'h:mm a')
}
