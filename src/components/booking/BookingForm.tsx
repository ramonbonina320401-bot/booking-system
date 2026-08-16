import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { toast } from 'sonner'
import {
  ArrowLeft,
  ArrowRight,
  Ban,
  CalendarCheck2,
  CheckCircle2,
  DoorOpen,
  Loader2,
  Mail,
  Presentation,
} from 'lucide-react'

import { useResources } from '@/hooks/useResources'
import { useBookings, useCreateBooking, SlotTakenError } from '@/hooks/useBookings'
import { useBookingFlowStore } from '@/stores/useBookingFlowStore'
import { useUIStore } from '@/stores/useUIStore'
import { useAuth } from '@/hooks/useAuth'
import { useI18n, tr } from '@/lib/i18n'
import { formatTimeLabel } from '@/lib/timeSlots'
import { hapticSuccess } from '@/lib/haptics'
import { BookingCalendar } from '@/components/booking/BookingCalendar'
import { PageHero } from '@/components/layout/PageHero'
import { AnnouncementsBanner } from '@/components/layout/AnnouncementsBanner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { formatDateTime } from '@/lib/timeSlots'
import { cn } from '@/lib/utils'

const STEPS = ['resource', 'datetime', 'review'] as const

function resourceIcon(name: string) {
  if (/projector|screen|presentation/i.test(name)) return Presentation
  if (/room|conference|huddle|meeting/i.test(name)) return DoorOpen
  return CalendarCheck2
}

export function BookingForm() {
  const navigate = useNavigate()
  const { t } = useI18n()
  const [searchParams] = useSearchParams()
  // Home page resource cards deep-link here: /book?resource=<id>
  const resourceParam = searchParams.get('resource')
  const { user, profile, sendVerificationEmail } = useAuth()
  const { data: resources = [], isLoading } = useResources()
  const { data: myBookings = [], isLoading: myBookingsLoading } = useBookings()
  const createBooking = useCreateBooking()
  const openCelebration = useUIStore((s) => s.openCelebration)
  const [submitting, setSubmitting] = useState(false)

  const { step, resourceId, date, startTime, endTime, notes, setResourceId, setStep, setNotes, reset } =
    useBookingFlowStore()

  // Fresh form every time the user enters the booking flow — don't resume a
  // half-finished resource/date/time selection from a previous session.
  // When arriving via ?resource=<id> (Home page cards), pre-select it.
  useEffect(() => {
    reset()
    if (resourceParam) setResourceId(resourceParam)
  }, [reset, resourceParam, setResourceId])

  const selectedResource = resources.find((r) => r.id === resourceId)

  const needsVerification = Boolean(user?.email && !user?.emailVerified)

  const handleVerifyEmail = async () => {
    const { error } = await sendVerificationEmail()
    if (error) toast.error(error.message)
    else toast.success(tr('booking.verifySent'))
  }

  const handleSubmit = async () => {
    if (!resourceId || !startTime || !endTime) return
    // Email accounts must verify before booking (rules enforce server-side too).
    if (needsVerification) {
      toast.error(tr('booking.verifyRequired'))
      return
    }
    setSubmitting(true)
    try {
      await createBooking.mutateAsync({
        resource_id: resourceId,
        start_time: startTime,
        end_time: endTime,
        notes: notes || null,
      })
      // "First booking" celebration: myBookings holds the PRE-submit list
      // (the invalidation refetch hasn't landed yet), so an empty list here
      // means this really is the user's very first booking.
      const isFirstBooking = !myBookingsLoading && myBookings.length === 0
      hapticSuccess()
      if (isFirstBooking) openCelebration()
      // Success screen — shows the confirmed details with quick next actions.
      reset()
      navigate('/booking-success', {
        state: {
          resourceName: selectedResource?.name ?? null,
          startTime: startTime ?? null,
          endTime: endTime ?? null,
        },
      })
    } catch (err) {
      if (err instanceof SlotTakenError) {
        // The deterministic slot doc was already claimed (atomic conflict).
        toast.error(tr('booking.slotTaken'))
      } else {
        toast.error(err instanceof Error ? err.message : tr('booking.failed'))
      }
    } finally {
      setSubmitting(false)
    }
  }

  const canNext = {
    resource: Boolean(resourceId),
    datetime: Boolean(date && startTime),
    review: true,
  }[step]

  // Shared action bar (rendered inline on desktop, sticky on mobile).
  const goBack = () => {
    if (step === 'resource') navigate('/')
    else setStep(STEPS[STEPS.indexOf(step) - 1])
  }
  const goNext = () => {
    if (step === 'review') void handleSubmit()
    else if (canNext) setStep(STEPS[STEPS.indexOf(step) + 1])
  }
  const actionBar = (
    <div className="flex items-center justify-between gap-3">
      <Button variant="outline" onClick={goBack}>
        <ArrowLeft className="h-4 w-4" /> {t('common.back')}
      </Button>
      {step === 'review' ? (
        <Button onClick={() => void handleSubmit()} disabled={submitting}>
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CalendarCheck2 className="h-4 w-4" />}
          {t('booking.confirmBooking')}
        </Button>
      ) : (
        <Button onClick={goNext} disabled={!canNext}>
          {t('common.next')} <ArrowRight className="h-4 w-4" />
        </Button>
      )}
    </div>
  )

  // Deactivated accounts are blocked from booking — rules enforce this
  // server-side too; this just explains why the form is gone.
  if (profile?.active === false) {
    return (
      <div className="mx-auto w-full max-w-3xl">
        <PageHero eyebrow={t('booking.eyebrow')} title={t('booking.newBooking')} />
        <Card>
          <CardContent className="pt-6">
            <EmptyState
              icon={Ban}
              title={t('booking.deactivatedTitle')}
              description={t('booking.deactivatedDesc')}
            />
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-3xl">
      {/* Announcements — closures and notices visible above the booking card */}
      <AnnouncementsBanner />

      {/* Page header — same hero treatment as the Home page */}
      <PageHero eyebrow={t('booking.eyebrow')} title={t('booking.newBooking')} />

      {/* Email verification gate — account has an email but hasn't verified it */}
      {needsVerification && (
        <div className="mb-5 flex flex-col gap-3 rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4 sm:flex-row sm:items-center">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-500/20 text-amber-600 dark:text-amber-400">
            <Mail className="h-5 w-5" />
          </span>
          <div className="flex-1">
            <p className="text-sm font-semibold">{t('booking.verifyTitle')}</p>
            <p className="text-sm text-muted-foreground">{t('booking.verifyDesc')}</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => void handleVerifyEmail()} className="shrink-0">
            {t('booking.verifySend')}
          </Button>
        </div>
      )}

      <Card>
        <CardHeader className="pb-3">
          <CardDescription>{t('booking.step', { n: STEPS.indexOf(step) + 1 })}</CardDescription>
          {/* Step indicator with labels — Resource / Date & Time / Confirm */}
          <div className="mt-2 flex gap-2" aria-hidden="true">
            {STEPS.map((s, i) => {
              const active = STEPS.indexOf(step) === i
              const done = STEPS.indexOf(step) > i
              return (
                <div key={s} className="flex-1 space-y-1">
                  <span className={cn('block h-1.5 w-full rounded-full', done || active ? 'bg-primary' : 'bg-muted')} />
                  <span
                    className={cn(
                      'block text-center text-[10px] font-semibold uppercase tracking-wide',
                      active ? 'text-primary' : 'text-muted-foreground'
                    )}
                  >
                    {s === 'resource' ? t('booking.stepResource') : s === 'datetime' ? t('booking.stepDatetime') : t('booking.stepReview')}
                  </span>
                </div>
              )
            })}
          </div>
        </CardHeader>
        <CardContent>
          {step === 'resource' && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">{t('booking.pickResource')}</p>
              {isLoading && (
                <div className="grid gap-3 sm:grid-cols-2" aria-hidden="true">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="rounded-2xl border p-4">
                      <div className="flex items-center gap-3">
                        <Skeleton className="h-10 w-10 rounded-full" />
                        <Skeleton className="h-5 w-32 rounded-md" />
                      </div>
                      <Skeleton className="mt-3 h-4 w-3/4 rounded-md" />
                    </div>
                  ))}
                </div>
              )}
              {!isLoading && resources.length === 0 && (
                <EmptyState
                  compact
                  icon={CalendarCheck2}
                  title={t('booking.noResources')}
                  description={t('booking.noResourcesDesc')}
                />
              )}
              <div className="grid gap-3 sm:grid-cols-2">
                {resources.map((r) => {
                  const Icon = resourceIcon(r.name)
                  const active = resourceId === r.id
                  return (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => setResourceId(r.id)}
                      aria-pressed={active}
                      className={cn(
                        'lift-hover group rounded-2xl border p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                        active ? 'border-primary bg-primary/10' : 'hover:bg-accent/10'
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-foreground shadow-sm">
                          <Icon className="h-5 w-5 text-primary" />
                        </span>
                        <span className="font-semibold">{r.name}</span>
                        {active && <CheckCircle2 className="ml-auto h-4 w-4 shrink-0 text-primary" />}
                      </div>
                      {r.description && <p className="mt-2 text-sm text-muted-foreground">{r.description}</p>}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {step === 'datetime' && resourceId && <BookingCalendar resourceId={resourceId} />}

          {step === 'review' && (
            <div className="space-y-4">
              <div className="rounded-2xl bg-muted/40 p-4 text-sm">
                <dl className="space-y-2">
                  <div className="flex justify-between gap-4">
                    <dt className="text-muted-foreground">{t('booking.resource')}</dt>
                    <dd className="font-medium">{selectedResource?.name ?? '—'}</dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-muted-foreground">{t('booking.when')}</dt>
                    <dd className="font-medium">{startTime ? formatDateTime(startTime) : '—'}</dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-muted-foreground">{t('booking.until')}</dt>
                    <dd className="font-medium">{endTime ? formatDateTime(endTime) : '—'}</dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-muted-foreground">{t('booking.bookedAs')}</dt>
                    {/* The real account name, not the role label */}
                    <dd className="font-medium">{profile?.full_name || user?.email || '—'}</dd>
                  </div>
                </dl>
              </div>
              <div className="space-y-2">
                <Label htmlFor="booking-notes">{t('booking.notes')}</Label>
                <Textarea
                  id="booking-notes"
                  placeholder={t('booking.notesPlaceholder')}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>
            </div>
          )}

          {/* Desktop: inline action bar */}
          <div className="mt-6 hidden md:block">{actionBar}</div>
        </CardContent>
      </Card>

      {/* Mobile: sticky bottom action bar — always visible above the tab bar,
          with a live summary of what's selected so far. */}
      <div
        className="fixed inset-x-0 z-40 border-t bg-background/95 px-4 py-3 backdrop-blur md:hidden"
        style={{
          borderColor: 'var(--app-border)',
          bottom: 'calc(64px + env(safe-area-inset-bottom))',
        }}
      >
        <div className="mx-auto flex max-w-md items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs text-muted-foreground">
              {step === 'resource' && (resourceId ? selectedResource?.name ?? '…' : t('booking.selectHint'))}
              {step === 'datetime' &&
                (startTime
                  ? `${date ? date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }) : '—'} · ${formatTimeLabel(startTime)}`
                  : date
                    ? date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
                    : t('booking.selectHint'))}
              {step === 'review' &&
                (startTime
                  ? `${date ? date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }) : '—'} · ${formatTimeLabel(startTime)}`
                  : selectedResource?.name ?? '…')}
            </p>
          </div>
          {actionBar}
        </div>
      </div>
    </div>
  )
}
