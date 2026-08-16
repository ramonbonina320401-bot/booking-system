import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import { ArrowRight, Bell, Clock, Phone, User } from 'lucide-react'

import { useAdminNotifications } from '@/hooks/useAdminNotifications'
import { useI18n } from '@/lib/i18n'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { formatDateTime } from '@/lib/timeSlots'

/**
 * Facebook-style notification bell for the admin header.
 *
 * - Live badge: number of bookings awaiting approval (real-time via onSnapshot).
 * - Pulse dot when a brand-new pending booking arrives (cleared on open).
 * - Dropdown lists the pending bookings with a deep link to approve them.
 */
export function AdminNotificationBell() {
  const { pending, needsAttention, acknowledge } = useAdminNotifications()
  const { t } = useI18n()
  const [isOpen, setIsOpen] = useState(false)
  const boxRef = useRef<HTMLDivElement>(null)

  // Close on outside click / Escape (same pattern as UserMenu).
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setIsOpen(false)
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      document.addEventListener('keydown', handleKeyDown)
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen])

  const toggle = () => {
    const next = !isOpen
    setIsOpen(next)
    if (next) acknowledge()
  }

  return (
    <div className="relative" ref={boxRef}>
      <Button
        variant="ghost"
        size="icon"
        className="relative"
        onClick={toggle}
        aria-label={t('notif.aria', { count: pending.length })}
        aria-expanded={isOpen}
      >
        <Bell className="h-5 w-5" />
        {/* Live count badge */}
        {pending.length > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
            {pending.length > 9 ? '9+' : pending.length}
          </span>
        )}
        {/* New-booking pulse dot */}
        {needsAttention && (
          <span className="absolute right-1.5 top-1.5 flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-primary" />
          </span>
        )}
      </Button>

      {isOpen && (
        <div
          className="absolute right-0 top-12 z-50 w-80 max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border bg-popover/95 text-popover-foreground shadow-2xl backdrop-blur-md animate-in fade-in-0 zoom-in-95"
          style={{ borderColor: 'var(--app-border, rgba(255,255,255,0.1))' }}
          role="dialog"
          aria-label="Notifications"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b px-4 py-3">
            <p className="text-sm font-bold">{t('notif.title')}</p>
            {pending.length > 0 && (
              <span className="rounded-full bg-accent px-2 py-0.5 text-[10px] font-bold uppercase text-accent-foreground">
                {t('notif.pending', { count: pending.length })}
              </span>
            )}
          </div>

          {/* Pending bookings */}
          <div className="max-h-80 space-y-1 overflow-y-auto p-2">
            {pending.length === 0 ? (
              <EmptyState
                compact
                icon={Bell}
                title={t('notif.allCaughtUp')}
                description={t('notif.desc')}
              />
            ) : (
              pending.slice(0, 10).map((b) => (
                <Link
                  key={b.id}
                  to="/admin/bookings?status=pending"
                  className="flex items-start gap-3 rounded-xl p-2.5 transition-colors hover:bg-accent/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <Clock className="h-4 w-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">{b.resource?.name ?? t('notif.booking')}</span>
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <User className="h-3 w-3 shrink-0" />
                      <span className="truncate">{b.user?.full_name ?? '—'}</span>
                    </span>
                    {b.user?.phone && (
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Phone className="h-3 w-3 shrink-0" />
                        <span className="truncate">{b.user.phone}</span>
                      </span>
                    )}
                    <span className="block text-xs text-muted-foreground">{formatDateTime(b.start_time)}</span>
                  </span>
                </Link>
              ))
            )}
          </div>

          {/* Footer deep link */}
          <Link
            to="/admin/bookings?status=pending"
            className="flex items-center justify-center gap-1.5 border-t px-4 py-2.5 text-xs font-semibold text-primary transition-colors hover:bg-accent/40"
          >
            {t('notif.viewAll')} <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      )}
    </div>
  )
}
