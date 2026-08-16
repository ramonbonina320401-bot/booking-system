/**
 * routeProgress — a tiny pub/sub store that tracks whether any lazy route
 * chunk (or guard check) is currently loading. The top progress bar subscribes
 * to it; Suspense fallbacks and the guard PageLoader signal start/end.
 *
 * Using a plain module store (instead of context) keeps the signal wiring out
 * of the tree entirely — any component can start/stop loading with zero props.
 */
type Listener = () => void

let active = 0
const listeners = new Set<Listener>()

export function startRouteLoading() {
  active += 1
  emit()
}

export function endRouteLoading() {
  active = Math.max(0, active - 1)
  emit()
}

export function isRouteLoading() {
  return active > 0
}

export function subscribeRouteProgress(fn: Listener) {
  listeners.add(fn)
  return () => {
    listeners.delete(fn)
  }
}

function emit() {
  listeners.forEach((fn) => fn())
}
