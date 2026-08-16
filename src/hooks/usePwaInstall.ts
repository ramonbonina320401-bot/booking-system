import { useCallback, useSyncExternalStore } from 'react'

// ---------------------------------------------------------------------------
// usePwaInstall — real install-prompt handling for the "Add to home screen"
// button.
//
// The browser fires `beforeinstallprompt` ONCE per page load when the app is
// installable (manifest + service worker). Components that mount later (e.g.
// a dropdown item that only renders while open) would miss it, so the state
// lives in a module-level singleton store and every hook instance subscribes
// to the same value.
//
// - Chrome/Edge/Android: install() fires the NATIVE prompt.
// - iOS Safari never fires `beforeinstallprompt` — install is manual via the
//   Share menu. We detect iOS and report canInstall=true so the UI can show
//   the button and open step-by-step instructions instead of hiding.
// - Already installed (running standalone): installed=true, button hides.
// ---------------------------------------------------------------------------

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
}

export type InstallResult = 'accepted' | 'dismissed' | 'unavailable'

// ---------------------------------------------------------------------------
// Module-level shared state
// ---------------------------------------------------------------------------

interface InstallState {
  canInstall: boolean
  installed: boolean
  isIOS: boolean
  isStandalone: boolean
}

let state: InstallState = { canInstall: false, installed: false, isIOS: false, isStandalone: false }
let deferred: BeforeInstallPromptEvent | null = null
let initialized = false
const listeners = new Set<() => void>()

function update(patch: Partial<InstallState>) {
  state = { ...state, ...patch }
  listeners.forEach((l) => l())
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

function getSnapshot() {
  return state
}

/** One-time page-level wiring. Safe to call from any hook instance. */
function ensureSetup() {
  if (initialized || typeof window === 'undefined') return
  initialized = true

  const standalone =
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as unknown as { standalone?: boolean }).standalone === true

  // iPadOS Safari reports as MacIntel with a touchscreen — include it.
  const ua = navigator.userAgent
  const iOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)

  if (standalone) {
    update({ installed: true, isStandalone: true, isIOS: iOS })
    return
  }

  update({ isStandalone: false, isIOS: iOS })

  // iOS: no native prompt, but install IS possible manually → keep the button
  // visible so the UI can walk the user through Share → Add to home.
  if (iOS) {
    update({ canInstall: true })
    return
  }

  // Always listen for the prompt. We intentionally DON'T early-return on
  // unsupported browsers: the install button stays visible everywhere and
  // falls back to step-by-step instructions (InstallAppDialog) instead of
  // hiding — that's what makes the "Download the app" button always findable.
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    deferred = e as BeforeInstallPromptEvent
    update({ canInstall: true })
  })

  // No native prompt (unsupported browser / desktop) → still show the button
  // so users can install from the browser menu; install() returns
  // 'unavailable' and callers open the instructions dialog.
  update({ canInstall: true })

  window.addEventListener('appinstalled', () => {
    deferred = null
    update({ installed: true, canInstall: false })
  })
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function usePwaInstall() {
  ensureSetup()
  const { canInstall, installed, isIOS, isStandalone } = useSyncExternalStore(subscribe, getSnapshot)

  /** Trigger the native browser install dialog.
   *  - 'accepted'    → the app was installed.
   *  - 'dismissed'   → the user saw the native prompt but declined — keep the
   *                    button available so they can try again.
   *  - 'unavailable' → no native prompt exists (iOS Safari, unsupported
   *                    desktop browser, or the prompt failed) — callers should
   *                    open the manual instructions modal. */
  const install = useCallback(async (): Promise<InstallResult> => {
    const d = deferred
    if (!d) return 'unavailable'
    try {
      await d.prompt()
    } catch {
      // Prompt unavailable/failed (already shown, unsupported) — fall back to
      // manual instructions instead of throwing.
      return 'unavailable'
    }
    const { outcome } = await d.userChoice
    deferred = null
    if (outcome === 'accepted') {
      update({ installed: true, canInstall: false })
    }
    return outcome === 'accepted' ? 'accepted' : 'dismissed'
  }, [])

  return { canInstall, installed, install, isIOS, isStandalone }
}
