import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Clock3, Loader2, RotateCcw, Save, Undo2 } from 'lucide-react'
import { doc, setDoc } from 'firebase/firestore'

import { db } from '@/lib/firebase'
import { logAudit } from '@/lib/audit'
import { useSettings } from '@/contexts/SettingsContext'
import { useI18n, tr } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

/** Render a 24h hour as "8:00 AM" / "6:00 PM" style. */
function hourLabel(hour: number): string {
  const h12 = hour % 12 === 0 ? 12 : hour % 12
  const ampm = hour < 12 ? 'AM' : 'PM'
  return `${h12}:00 ${ampm}`
}

const OPEN_OPTIONS = Array.from({ length: 17 }, (_, i) => i + 6) // 6 AM – 10 PM
const CLOSE_OPTIONS = Array.from({ length: 18 }, (_, i) => i + 7) // 7 AM – 11 PM
const DURATION_OPTIONS = [15, 30, 45, 60, 90, 120]
const REMINDER_OPTIONS = [15, 30, 45, 60, 90, 120, 180]
const REMINDER_DAY_OPTIONS = [0, 1, 2, 3, 7] // 0 = off

/** Weekday order used in the closed-days picker (0=Sun … 6=Sat). */
const DAY_VALUES = [0, 1, 2, 3, 4, 5, 6]

/** Built-in defaults (what SettingsContext falls back to before Firestore). */
const DEFAULTS = {
  openHour: 8,
  closeHour: 18,
  slotMinutes: 60,
  closedDays: [] as number[],
  reminderMinutes: 30,
  reminderDays: 0,
}

/** Short weekday label in the current locale (e.g. "Sun", "Linggo"). */
function dayLabel(value: number): string {
  // 2026-01-04 is a Sunday — offset by the weekday index for any day's name.
  return new Date(2026, 0, 4 + value).toLocaleDateString(undefined, { weekday: 'short' })
}

/**
 * BookingHoursSettings — configurable bookable window + slot length.
 *
 * Stored in system_settings (booking_open_hour / booking_close_hour /
 * slot_duration_minutes) and consumed by the booking calendar + availability
 * counts via SettingsContext.bookingConfig — no redeploy needed.
 */
export function BookingHoursSettings() {
  const { bookingConfig, refresh } = useSettings()
  const { t } = useI18n()
  const [openHour, setOpenHour] = useState<number>(bookingConfig.openHour)
  const [closeHour, setCloseHour] = useState<number>(bookingConfig.closeHour)
  const [slotMinutes, setSlotMinutes] = useState<number>(bookingConfig.durationMinutes)
  const [closedDays, setClosedDays] = useState<number[]>(bookingConfig.closedDays)
  const [reminderMinutes, setReminderMinutes] = useState<number>(bookingConfig.reminderMinutes)
  const [reminderDays, setReminderDays] = useState<number>(bookingConfig.reminderDays)
  const [saving, setSaving] = useState(false)

  // Anything differs from the last-saved values? (drives the Save button +
  // the unsaved badge — same pattern as the branding panel).
  const sameArrays = (a: number[], b: number[]) => a.length === b.length && a.every((v, i) => v === b[i])
  const dirty =
    openHour !== bookingConfig.openHour ||
    closeHour !== bookingConfig.closeHour ||
    slotMinutes !== bookingConfig.durationMinutes ||
    !sameArrays([...closedDays].sort(), [...bookingConfig.closedDays].sort()) ||
    reminderMinutes !== bookingConfig.reminderMinutes ||
    reminderDays !== bookingConfig.reminderDays
  const invalid = closeHour <= openHour

  // The context exposes defaults (8AM–6PM, 60 min) before Firestore responds.
  // Sync our local draft whenever the loaded values change (defaults → real
  // settings) so the form never shows stale values after a reload. A save
  // re-fetches the same values, so an in-progress edit is not clobbered.
  useEffect(() => {
    setOpenHour(bookingConfig.openHour)
    setCloseHour(bookingConfig.closeHour)
    setSlotMinutes(bookingConfig.durationMinutes)
    setClosedDays(bookingConfig.closedDays)
    setReminderMinutes(bookingConfig.reminderMinutes)
    setReminderDays(bookingConfig.reminderDays)
  }, [bookingConfig])

  const save = async () => {
    if (closeHour <= openHour) {
      toast.error(tr('st.hoursInvalid'))
      return
    }
    setSaving(true)
    try {
      await Promise.all([
        setDoc(doc(db, 'system_settings', 'booking_open_hour'), { key: 'booking_open_hour', value: openHour, value_type: 'number', updated_at: Date.now() }, { merge: true }),
        setDoc(doc(db, 'system_settings', 'booking_close_hour'), { key: 'booking_close_hour', value: closeHour, value_type: 'number', updated_at: Date.now() }, { merge: true }),
        setDoc(doc(db, 'system_settings', 'slot_duration_minutes'), { key: 'slot_duration_minutes', value: slotMinutes, value_type: 'number', updated_at: Date.now() }, { merge: true }),
        setDoc(doc(db, 'system_settings', 'booking_closed_days'), { key: 'booking_closed_days', value: closedDays.sort(), value_type: 'days', updated_at: Date.now() }, { merge: true }),
        setDoc(doc(db, 'system_settings', 'booking_reminder_minutes'), { key: 'booking_reminder_minutes', value: reminderMinutes, value_type: 'number', updated_at: Date.now() }, { merge: true }),
        setDoc(doc(db, 'system_settings', 'booking_reminder_days'), { key: 'booking_reminder_days', value: reminderDays, value_type: 'number', updated_at: Date.now() }, { merge: true }),
      ])
      await refresh()
      await logAudit({
        action: 'booking_hours_updated',
        target_type: 'settings',
        details: `${hourLabel(openHour)}–${hourLabel(closeHour)} / ${slotMinutes}min / closed=[${closedDays.sort().join(',')}] / remind=${reminderMinutes}min / remindDays=${reminderDays}`,
      })
      toast.success(tr('st.hoursSaved'))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : tr('st.hoursSaveFailed'))
    } finally {
      setSaving(false)
    }
  }

  /** Undo — revert this section to the last-saved values. */
  const resetToSaved = () => {
    setOpenHour(bookingConfig.openHour)
    setCloseHour(bookingConfig.closeHour)
    setSlotMinutes(bookingConfig.durationMinutes)
    setClosedDays(bookingConfig.closedDays)
    setReminderMinutes(bookingConfig.reminderMinutes)
    setReminderDays(bookingConfig.reminderDays)
    toast.info(tr('st.hoursResetSaved'))
  }

  /** Factory reset — back to the app's built-in defaults. */
  const resetToDefaults = () => {
    setOpenHour(DEFAULTS.openHour)
    setCloseHour(DEFAULTS.closeHour)
    setSlotMinutes(DEFAULTS.slotMinutes)
    setClosedDays([...DEFAULTS.closedDays])
    setReminderMinutes(DEFAULTS.reminderMinutes)
    setReminderDays(DEFAULTS.reminderDays)
    toast.info(tr('st.hoursResetDefaults'))
  }

  return (
    <Card className={cn(dirty && 'border-primary/40')}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock3 className="h-4 w-4 text-primary" aria-hidden="true" />
          {t('st.hours')}
          {dirty && (
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary">
              {t('st.hoursUnsaved')}
            </span>
          )}
        </CardTitle>
        <CardDescription>{t('st.hoursDesc')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-2">
            <Label>{t('st.openTime')}</Label>
            <Select value={String(openHour)} onValueChange={(v) => setOpenHour(Number(v))}>
              <SelectTrigger aria-label={t('st.openTime')}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {OPEN_OPTIONS.map((h) => (
                  <SelectItem key={h} value={String(h)}>
                    {hourLabel(h)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>{t('st.closeTime')}</Label>
            <Select value={String(closeHour)} onValueChange={(v) => setCloseHour(Number(v))}>
              <SelectTrigger aria-label={t('st.closeTime')}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CLOSE_OPTIONS.map((h) => (
                  <SelectItem key={h} value={String(h)}>
                    {hourLabel(h)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>{t('st.slotLength')}</Label>
            <Select value={String(slotMinutes)} onValueChange={(v) => setSlotMinutes(Number(v))}>
              <SelectTrigger aria-label={t('st.slotLength')}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DURATION_OPTIONS.map((m) => (
                  <SelectItem key={m} value={String(m)}>
                    {t('st.slotMinutes', { minutes: m })}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>{t('st.reminderBefore')}</Label>
            <Select value={String(reminderMinutes)} onValueChange={(v) => setReminderMinutes(Number(v))}>
              <SelectTrigger aria-label={t('st.reminderBefore')}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {REMINDER_OPTIONS.map((m) => (
                  <SelectItem key={m} value={String(m)}>
                    {t('st.reminderMinutes', { minutes: m })}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>{t('st.remindDaysBefore')}</Label>
            <Select value={String(reminderDays)} onValueChange={(v) => setReminderDays(Number(v))}>
              <SelectTrigger aria-label={t('st.remindDaysBefore')}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {REMINDER_DAY_OPTIONS.map((d) => (
                  <SelectItem key={d} value={String(d)}>
                    {d === 0 ? t('st.remindDaysOff') : t('st.remindDaysValue', { days: d })}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Closed days — weekdays with no bookable slots */}
        <div className="space-y-2">
          <Label>{t('st.closedDays')}</Label>
          <div className="flex flex-wrap gap-1.5">
            {DAY_VALUES.map((value) => {
              const active = closedDays.includes(value)
              return (
                <button
                  key={value}
                  type="button"
                  aria-pressed={active}
                  onClick={() =>
                    setClosedDays((prev) =>
                      active ? prev.filter((v) => v !== value) : [...prev, value]
                    )
                  }
                  className={cn(
                    'flex h-9 w-12 items-center justify-center rounded-full text-xs font-semibold transition-colors',
                    active
                      ? 'bg-primary text-primary-foreground'
                      : 'border bg-card text-muted-foreground hover:border-primary/40'
                  )}
                >
                  {dayLabel(value)}
                </button>
              )
            })}
          </div>
          <p className="text-xs text-muted-foreground">{t('st.closedDaysHint')}</p>
        </div>

        <p className="text-xs text-muted-foreground">{t('st.hoursNote')}</p>

        <div className="flex flex-wrap items-center justify-end gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={resetToSaved}
            disabled={!dirty || saving}
            title={t('st.hoursResetSaved')}
          >
            <Undo2 className="h-4 w-4" />
            {t('st.hoursReset')}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={resetToDefaults}
            disabled={saving}
            title={t('st.hoursResetDefaults')}
          >
            <RotateCcw className="h-4 w-4" />
            {t('st.hoursDefaults')}
          </Button>
          <Button
            onClick={() => void save()}
            disabled={!dirty || saving || invalid}
            variant="outline"
            title={invalid ? tr('st.hoursInvalid') : dirty ? undefined : tr('st.hoursNoChanges')}
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {t('st.saveHours')}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
