import { create } from 'zustand'

// ---------------------------------------------------------------------------
// Theme store (Zustand) — light / dark / system, persisted to localStorage.
//
// - `theme`   : the user's explicit choice (defaults to 'system')
// - `resolved`: the effective mode ('light' | 'dark') after resolving 'system'
//               against the OS preference
//
// The `.dark` class is toggled on <html>. An inline script in index.html does
// the same thing before React mounts to avoid a flash of the wrong theme.
// ---------------------------------------------------------------------------

export type Theme = 'light' | 'dark' | 'system'
export type ResolvedTheme = 'light' | 'dark'

const STORAGE_KEY = 'booking-theme'

function systemPrefersDark(): boolean {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches
}

function readStoredTheme(): Theme {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored === 'light' || stored === 'dark' || stored === 'system') return stored
  } catch {
    // localStorage unavailable — fall through
  }
  // Default to light mode (white) — no OS preference followed
  return 'light'
}

function resolve(theme: Theme): ResolvedTheme {
  if (theme === 'system') return systemPrefersDark() ? 'dark' : 'light'
  return theme
}

function applyClass(resolved: ResolvedTheme): void {
  document.documentElement.classList.toggle('dark', resolved === 'dark')
}

interface ThemeState {
  theme: Theme
  resolved: ResolvedTheme
  setTheme: (theme: Theme) => void
  /** Flip between the current effective mode (light <-> dark). */
  toggle: () => void
}

const initial = readStoredTheme()

export const useThemeStore = create<ThemeState>((set, get) => ({
  theme: initial,
  resolved: resolve(initial),
  setTheme: (theme) => {
    try {
      localStorage.setItem(STORAGE_KEY, theme)
    } catch {
      // ignore storage errors
    }
    const resolved = resolve(theme)
    applyClass(resolved)
    set({ theme, resolved })
  },
  toggle: () => {
    const next: Theme = get().resolved === 'dark' ? 'light' : 'dark'
    get().setTheme(next)
  },
}))

// Apply the class immediately (idempotent with the index.html inline script).
applyClass(useThemeStore.getState().resolved)

// Follow OS preference changes while the user is on 'system'.
if (typeof window !== 'undefined' && window.matchMedia) {
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    const s = useThemeStore.getState()
    if (s.theme === 'system') s.setTheme('system')
  })
}

/** Subscribe to the effective theme (re-renders on change). */
export function useTheme(): ResolvedTheme {
  return useThemeStore((s) => s.resolved)
}
