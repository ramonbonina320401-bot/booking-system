import { useEffect, useRef, useState } from 'react'

import { isRouteLoading, subscribeRouteProgress } from '@/lib/routeProgress'

/**
 * RouteProgressBar — a thin YouTube-style bar pinned to the very top of the
 * screen. It appears while a lazy route chunk (or the guard check) is loading
 * and slides to full once everything is ready.
 *
 * It never blocks clicks (pointer-events-none) and respects reduced motion.
 */
export function RouteProgressBar() {
  const [visible, setVisible] = useState(false)
  const [progress, setProgress] = useState(0)
  const raf = useRef<number | null>(null)
  const hideTimer = useRef<number | null>(null)
  const reduceMotion = useRef(
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )

  useEffect(() => {
    const unsubscribe = subscribeRouteProgress(() => {
      if (isRouteLoading()) {
        // Loading (or continued loading) — show the bar and creep toward 88%.
        if (hideTimer.current) {
          window.clearTimeout(hideTimer.current)
          hideTimer.current = null
        }
        if (raf.current) cancelAnimationFrame(raf.current)
        setVisible(true)
        setProgress(10)
        const tick = () => {
          setProgress((p) => {
            const next = p < 88 ? p + (88 - p) * 0.12 : p
            if (next < 87.5) raf.current = requestAnimationFrame(tick)
            return next
          })
        }
        raf.current = requestAnimationFrame(tick)
      } else {
        // Everything finished — slide to 100%, then fade out.
        if (raf.current) cancelAnimationFrame(raf.current)
        setProgress(100)
        if (hideTimer.current) window.clearTimeout(hideTimer.current)
        hideTimer.current = window.setTimeout(() => {
          setVisible(false)
          setProgress(0)
        }, reduceMotion.current ? 0 : 320)
      }
    })

    return () => {
      unsubscribe()
      if (raf.current) cancelAnimationFrame(raf.current)
      if (hideTimer.current) window.clearTimeout(hideTimer.current)
    }
  }, [])

  if (!visible) return null

  return (
    <div
      className="pointer-events-none fixed inset-x-0 top-0 z-[120] h-0.5 overflow-hidden"
      aria-hidden="true"
      role="presentation"
    >
      <div
        className="h-full bg-primary transition-[width] duration-150 ease-out"
        style={{ width: `${progress}%` }}
      />
    </div>
  )
}
