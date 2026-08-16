import { useEffect, type ReactNode } from 'react'

import { startRouteLoading, endRouteLoading } from '@/lib/routeProgress'

/**
 * LoadingSignal — wraps a Suspense fallback (or any loading surface) and tells
 * the top RouteProgressBar when loading starts and ends. Mount = loading,
 * unmount = done (the lazy chunk finished and the real page took over).
 */
export function LoadingSignal({ children }: { children: ReactNode }) {
  useEffect(() => {
    startRouteLoading()
    return () => endRouteLoading()
  }, [])

  return <>{children}</>
}
