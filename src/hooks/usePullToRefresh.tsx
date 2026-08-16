import { useCallback, useEffect, useRef, useState } from 'react'
import { RefreshCw } from 'lucide-react'

/**
 * usePullToRefresh — native-app "pull down to refresh" for touch screens.
 *
 * Attach the returned handlers to the page's scroll container:
 *
 *   const { pull, refreshing, handlers } = usePullToRefresh(() => refetch())
 *   <main {...handlers}> ... </main>
 *   {refreshing && <PullIndicator pull={pull} refreshing={refreshing} />}
 *
 * Only activates on coarse-pointer (touch) devices and only when the page is
 * already scrolled to the top, so it never fights normal scrolling. Everything
 * is pointer-event driven (touchstart/touchmove/touchend), not mouse events.
 */
export function usePullToRefresh(onRefresh: () => Promise<unknown> | void, enabled = true) {
  const [pull, setPull] = useState(0) // 0..1 progress toward the trigger
  const [refreshing, setRefreshing] = useState(false)
  const startY = useRef<number | null>(null)
  const pulling = useRef(false)
  const isTouch = useRef(
    typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(pointer: coarse)').matches
  )

  const THRESHOLD = 72 // px of pull distance needed to trigger

  useEffect(() => {
    // Re-evaluate once in case the device is flipped/resized at runtime.
    isTouch.current =
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(pointer: coarse)').matches
  }, [])

  const onTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (!enabled || refreshing || !isTouch.current) return
      if (window.scrollY > 0) return
      startY.current = e.touches[0].clientY
      pulling.current = false
    },
    [enabled, refreshing]
  )

  const onTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (!enabled || refreshing || !isTouch.current || startY.current == null) return
      const dy = e.touches[0].clientY - startY.current
      // Only pull when the page is at the very top and the gesture goes down.
      if (window.scrollY > 0 || dy <= 0) return
      pulling.current = true
      // Squeeze the distance so the indicator never flies off the screen.
      setPull(Math.min(1, dy / THRESHOLD))
    },
    [enabled, refreshing]
  )

  const onTouchEnd = useCallback(async () => {
    if (!pulling.current) {
      startY.current = null
      return
    }
    pulling.current = false
    startY.current = null
    if (pull >= 0.85) {
      setRefreshing(true)
      setPull(1)
      try {
        await onRefresh()
      } finally {
        setRefreshing(false)
        setPull(0)
      }
    } else {
      setPull(0)
    }
  }, [pull, onRefresh])

  return {
    pull,
    refreshing,
    handlers: { onTouchStart, onTouchMove, onTouchEnd },
  }
}

/**
 * PullIndicator — the animated pull-to-refresh spinner. Rendered above the
 * page content: rotates with the pull progress, then spins while refreshing.
 */
export function PullIndicator({ pull, refreshing }: { pull: number; refreshing: boolean }) {
  if (pull <= 0 && !refreshing) return null
  const rotate = refreshing ? 360 : 180 * pull
  return (
    <div
      className="pointer-events-none fixed left-1/2 top-16 z-40 -translate-x-1/2"
      aria-live="polite"
      role="status"
    >
      <div
        className="flex h-10 w-10 items-center justify-center rounded-full border bg-card text-primary shadow-sm transition-transform"
        style={{
          transform: `translateY(${refreshing ? 0 : -20 + 20 * pull}px) rotate(${rotate}deg)`,
          transition: refreshing ? 'transform 300ms linear' : 'transform 100ms linear',
        }}
      >
        <RefreshCw className="h-5 w-5" aria-hidden="true" />
      </div>
      <span className="sr-only">{refreshing ? 'Refreshing…' : 'Pull to refresh'}</span>
    </div>
  )
}
