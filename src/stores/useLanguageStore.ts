import { create } from 'zustand'

import type { Lang } from '@/lib/i18n/dictionaries'

// ---------------------------------------------------------------------------
// Language store (Zustand) — 'en' / 'fil', persisted to localStorage.
// Default is English (keeps current behavior); users can switch to Filipino.
// ---------------------------------------------------------------------------

const STORAGE_KEY = 'booking-lang'

function readStoredLang(): Lang {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored === 'en' || stored === 'fil') return stored
  } catch {
    // localStorage unavailable — fall through
  }
  return 'en'
}

interface LanguageState {
  lang: Lang
  setLang: (lang: Lang) => void
  /** Flip between English and Filipino. */
  toggle: () => void
}

export const useLanguageStore = create<LanguageState>((set, get) => ({
  lang: readStoredLang(),
  setLang: (lang) => {
    try {
      localStorage.setItem(STORAGE_KEY, lang)
    } catch {
      // ignore storage errors
    }
    set({ lang })
    document.documentElement.lang = lang === 'fil' ? 'fil' : 'en'
  },
  toggle: () => get().setLang(get().lang === 'en' ? 'fil' : 'en'),
}))

// Apply the <html lang> attribute immediately (idempotent).
if (typeof document !== 'undefined') {
  document.documentElement.lang = useLanguageStore.getState().lang === 'fil' ? 'fil' : 'en'
}
