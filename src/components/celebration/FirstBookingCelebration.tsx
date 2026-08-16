import { useEffect, useMemo } from 'react'
import { Link } from 'react-router'
import { CalendarPlus, PartyPopper, Sparkles, X } from 'lucide-react'

import { useUIStore } from '@/stores/useUIStore'
import { Button } from '@/components/ui/button'

/**
 * FirstBookingCelebration — celebratory overlay shown right after a user makes
 * their very first booking: a burst of CSS confetti + a branded card with
 * quick actions. Fully non-modal (pointer-events pass through to the page),
 * auto-dismisses, and honors prefers-reduced-motion (no confetti, instant card).
 */

const CONFETTI_COLORS = [
  'var(--app-primary)',
  'var(--app-accent)',
  '#ffd43b',
  '#69db7c',
  '#ff8787',
  '#74c0fc',
  '#e599f7',
]

const AUTO_DISMISS_MS = 8000

export function FirstBookingCelebration() {
  const open = useUIStore((s) => s.celebrationOpen)
  const close = useUIStore((s) => s.closeCelebration)

  // Confetti pieces are generated once per open — randomized layout, size and
  // timing so every celebration feels fresh. Decorative (aria-hidden).
  const pieces = useMemo(() => {
    if (!open) return []
    return Array.from({ length: 50 }, (_, i) => ({
      left: `${Math.random() * 100}%`,
      width: `${4 + Math.random() * 6}px`,
      height: `${8 + Math.random() * 10}px`,
      color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
      round: Math.random() > 0.5,
      duration: `${2.4 + Math.random() * 2}s`,
      delay: `${Math.random() * 1.2}s`,
    }))
  }, [open])

  // Auto-dismiss so the celebration never gets in the way.
  useEffect(() => {
    if (!open) return
    const t = window.setTimeout(close, AUTO_DISMISS_MS)
    return () => window.clearTimeout(t)
  }, [open, close])

  if (!open) return null

  return (
    <div className="pointer-events-none fixed inset-0 z-[60] overflow-hidden" role="dialog" aria-labelledby="celebration-title">
      {/* Confetti layer */}
      <div className="absolute inset-0" aria-hidden="true">
        {pieces.map((p, i) => (
          <span
            key={i}
            className="confetti-piece"
            style={{
              left: p.left,
              width: p.width,
              height: p.height,
              backgroundColor: p.color,
              borderRadius: p.round ? '9999px' : '2px',
              animationDuration: p.duration,
              animationDelay: p.delay,
            }}
          />
        ))}
      </div>

      {/* Card */}
      <div className="pointer-events-auto absolute inset-0 flex items-center justify-center p-4">
        <div className="celebration-pop relative w-full max-w-sm rounded-3xl border bg-card p-8 text-center shadow-2xl">
          <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary">
            <PartyPopper className="h-8 w-8" />
          </span>
          <h2 id="celebration-title" className="mt-4 text-2xl font-bold tracking-tight">
            You made your first booking!
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            It&apos;s now <span className="font-semibold text-foreground">pending</span> — an admin will confirm it
            shortly. 🎉
          </p>
          <div className="mt-6 flex flex-col gap-2">
            <Button asChild>
              <Link to="/book">
                <CalendarPlus className="h-4 w-4" /> Book another
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link to="/my-bookings">
                <Sparkles className="h-4 w-4" /> View my bookings
              </Link>
            </Button>
          </div>
          <button
            type="button"
            onClick={close}
            aria-label="Dismiss celebration"
            className="absolute right-4 top-4 rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>
    </div>
  )
}
