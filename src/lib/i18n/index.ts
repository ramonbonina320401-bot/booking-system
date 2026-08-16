import { useCallback } from 'react'

import { en, fil, type Dictionary, type DictEntry, type Lang } from '@/lib/i18n/dictionaries'
import { useLanguageStore } from '@/stores/useLanguageStore'

export type { Lang }

// ---------------------------------------------------------------------------
// i18n core — reactive hook for components + imperative tr() for toasts and
// event handlers that run outside React render.
//
//   const { t } = useI18n()
//   t('home.freeToday', { count: 3 })        // "3 free today" / "3 na libre ngayon"
//   t('nav.book')                            // "Book" / "Mag-book"
//
// Missing keys fall back to English, never a raw key.
// ---------------------------------------------------------------------------

const DICTIONARIES: Record<Lang, Dictionary> = { en, fil }

export type TranslateVars = Record<string, string | number>

function interpolate(template: string, vars?: TranslateVars): string {
  if (!vars) return template
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in vars ? String(vars[key]) : match
  )
}

function resolve(entry: DictEntry | undefined, vars?: TranslateVars): string {
  if (entry == null) return ''
  if (typeof entry === 'object') {
    const count = typeof vars?.count === 'number' ? vars.count : undefined
    const pick = count === 1 ? entry.one : entry.other
    return interpolate(pick, vars)
  }
  return interpolate(entry, vars)
}

/** Look up + interpolate a key in the CURRENT language (English fallback). */
export function tr(key: string, vars?: TranslateVars): string {
  const lang = useLanguageStore.getState().lang
  const dict = DICTIONARIES[lang]
  const found = dict[key] ?? en[key]
  const resolved = resolve(found, vars)
  return resolved === '' && found == null ? key : resolved
}

/** Reactive hook — re-renders when the language changes. */
export function useI18n() {
  const lang = useLanguageStore((s) => s.lang)
  const setLang = useLanguageStore((s) => s.setLang)
  const toggle = useLanguageStore((s) => s.toggle)

  const t = useCallback(
    (key: string, vars?: TranslateVars) => {
      const dict = DICTIONARIES[lang]
      const found = dict[key] ?? en[key]
      const resolved = resolve(found, vars)
      return resolved === '' && found == null ? key : resolved
    },
    [lang]
  )

  return { lang, setLang, toggle, t }
}

/** Human-readable label of a language, in that language. */
export function langLabel(lang: Lang): string {
  return lang === 'fil' ? 'Filipino' : 'English'
}
