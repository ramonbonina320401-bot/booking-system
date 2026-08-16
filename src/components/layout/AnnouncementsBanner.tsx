import { Megaphone, CalendarX2 } from 'lucide-react'

import {
  useAnnouncements,
  isAnnouncementActive,
  visibleAnnouncements,
  formatDateRange,
} from '@/hooks/useAnnouncements'
import { useI18n } from '@/lib/i18n'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

/**
 * AnnouncementsBanner — stack of active announcements (notices + scheduled
 * closures) rendered at the top of the Home and Booking pages. Closures that
 * are currently in effect get a warning tint so they stand out.
 */
export function AnnouncementsBanner() {
  const { data: all = [], isPending } = useAnnouncements()
  const { t } = useI18n()
  const visible = visibleAnnouncements(all)

  if (isPending) {
    return <Skeleton className="h-12 w-full rounded-2xl" aria-hidden="true" />
  }
  if (visible.length === 0) return null

  return (
    <div className="space-y-2">
      {visible.map((a) => {
        const isClosure = a.kind === 'closure'
        // In-effect closures get the warning tint; upcoming closures are informational.
        const inEffect = isClosure && isAnnouncementActive(a)
        return (
          <div
            key={a.id}
            role="status"
            className={cn(
              'flex items-start gap-3 rounded-2xl border p-3.5 text-sm shadow-sm sm:p-4',
              inEffect
                ? 'border-destructive/30 bg-destructive/5 text-destructive dark:border-destructive/40 dark:bg-destructive/10'
                : 'border-primary/25 bg-primary/5 text-foreground'
            )}
          >
            <span
              className={cn(
                'mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full',
                isClosure
                  ? 'bg-destructive/10 text-destructive dark:bg-destructive/20'
                  : 'bg-primary/10 text-primary'
              )}
            >
              {isClosure ? <CalendarX2 className="h-4 w-4" /> : <Megaphone className="h-4 w-4" />}
            </span>
            <div className="min-w-0">
              <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5 font-semibold">
                {a.title}
                <span
                  className={cn(
                    'rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide',
                    inEffect
                      ? 'bg-destructive/10 text-destructive dark:bg-destructive/20'
                      : 'bg-primary/10 text-primary'
                  )}
                >
                  {isClosure
                    ? formatDateRange(a.start_date, a.end_date)
                    : t('an.noticeBadge')}
                </span>
              </p>
              {a.body && <p className="mt-0.5 text-sm text-muted-foreground">{a.body}</p>}
            </div>
          </div>
        )
      })}
    </div>
  )
}
