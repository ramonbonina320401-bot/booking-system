/**
 * haptics — tiny wrapper around navigator.vibrate for subtle touch feedback
 * on mobile (confirm a booking, save a setting). Desktop browsers without a
 * vibrate API simply no-op, and everything is wrapped in try/catch so a
 * policy block can never break the app.
 */

/** Short confirmation pulse. */
export function hapticTap(pattern: number | number[] = 10) {
  try {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate(pattern)
    }
  } catch {
    /* no-op — vibration is a progressive enhancement */
  }
}

/** Two quick pulses — used for success/completion moments. */
export function hapticSuccess() {
  hapticTap([12, 40, 18])
}

/** Single longer pulse — used for destructive actions (cancel). */
export function hapticWarning() {
  hapticTap(30)
}
