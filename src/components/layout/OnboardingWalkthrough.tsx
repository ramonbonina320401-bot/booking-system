import { useEffect, useRef, useState } from 'react'
import { CalendarCheck2, ChevronRight, Smartphone, Zap } from 'lucide-react'

import { useAuth } from '@/hooks/useAuth'
import { useI18n } from '@/lib/i18n'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const STORAGE_KEY = 'booking_onboarding_seen_v1'

/**
 * OnboardingWalkthrough — a short 3-screen guide shown once to mobile
 * (coarse-pointer) users on their first visit, before they've signed in or
 * after they land on the home page. It's dismissible (Skip / swipe / tap
 * through) and never shows again once completed.
 *
 * Works on any screen size but is only *triggered* on touch phones so desktop
 * users never see it.
 */
export function OnboardingWalkthrough() {
  const { t } = useI18n()
  const { user } = useAuth()
  const [open, setOpen] = useState(false)
  const [index, setIndex] = useState(0)
  const touchX = useRef<number | null>(null)

  // Only auto-open on touch devices, once, and only for signed-in users —
  // a guest browsing the landing page doesn't need the flow tutorial yet.
  useEffect(() => {
    if (!user) return
    const isTouch =
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(pointer: coarse)').matches
    if (!isTouch) return
    try {
      if (localStorage.getItem(STORAGE_KEY)) return
    } catch {
      /* storage unavailable — fall through and show */
    }
    const timer = window.setTimeout(() => setOpen(true), 1200)
    return () => window.clearTimeout(timer)
  }, [user])

  const finish = () => {
    setOpen(false)
    setIndex(0)
    try {
      localStorage.setItem(STORAGE_KEY, '1')
    } catch {
      /* non-fatal */
    }
  }

  const go = (next: number) => {
    if (next >= slides.length) {
      finish()
    } else {
      setIndex(next)
    }
  }

  const slides = [
    {
      icon: CalendarCheck2,
      title: t('onboard.s1Title'),
      desc: t('onboard.s1Desc'),
    },
    {
      icon: Zap,
      title: t('onboard.s2Title'),
      desc: t('onboard.s2Desc'),
    },
    {
      icon: Smartphone,
      title: t('onboard.s3Title'),
      desc: t('onboard.s3Desc'),
    },
  ]

  if (!open) return null

  const slide = slides[index]

  return (
    <div
      className="fixed inset-0 z-[110] flex items-end justify-center bg-background/80 backdrop-blur-sm sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-label={t('onboard.aria')}
      onTouchStart={(e) => {
        touchX.current = e.touches[0].clientX
      }}
      onTouchEnd={(e) => {
        if (touchX.current == null) return
        const dx = e.changedTouches[0].clientX - touchX.current
        touchX.current = null
        if (Math.abs(dx) < 40) return
        go(index + (dx < 0 ? 1 : -1))
      }}
    >
      <div
        key={index}
        className="onboard-slide w-full max-w-md rounded-t-3xl border bg-card p-8 pb-6 shadow-2xl sm:rounded-3xl"
      >
        <div className="flex justify-center">
          <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <slide.icon className="h-8 w-8" aria-hidden="true" />
          </span>
        </div>
        <h2 className="mt-5 text-center text-xl font-bold tracking-tight">{slide.title}</h2>
        <p className="mt-2 text-center text-sm text-muted-foreground">{slide.desc}</p>

        {/* Dots */}
        <div className="mt-6 flex justify-center gap-1.5" aria-hidden="true">
          {slides.map((_, i) => (
            <span
              key={i}
              className={cn(
                'h-1.5 rounded-full transition-all',
                i === index ? 'w-6 bg-primary' : 'w-1.5 bg-muted-foreground/30'
              )}
            />
          ))}
        </div>

        <div className="mt-6 flex items-center gap-2">
          <Button variant="ghost" className="flex-1" onClick={finish}>
            {t('onboard.skip')}
          </Button>
          <Button className="flex-1" onClick={() => go(index + 1)}>
            {index === slides.length - 1 ? t('onboard.done') : t('onboard.next')}
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}
