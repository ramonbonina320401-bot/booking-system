import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  type ReactNode,
} from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { collection, getDocs } from 'firebase/firestore'

import { db } from '@/lib/firebase'
import { safeHex, contrastText, lightenForContrast } from '@/lib/color'
import { applyDynamicManifest } from '@/lib/pwa'
import { useTheme } from '@/stores/useThemeStore'
import type { SystemSetting, SettingsMap, SettingKey, BrandingValues } from '@/types/settings.types'

// ---------------------------------------------------------------------------
// SettingsContext — the dynamic branding engine.
//
// Data flow:  Firestore (system_settings/{key})  →  TanStack Query (fetch-once
// + cache) → this provider → CSS custom properties on <html> → Tailwind
// utilities (bg-primary, text-accent, ...) + <img>.
//
// Settings are fetched once and cached (staleTime: Infinity). The admin panel
// writes docs and calls refresh() (invalidateQueries) to re-apply instantly.
//
// Theme-aware: brand colors (primary/accent) apply in both themes; the
// neutral surface (background/card) comes from the DB in light mode and from
// the `.dark` CSS overrides in dark mode. In dark mode the brand colors are
// LIGHTENED (hue-preserving) until they clear WCAG 4.5:1 against the dark
// surfaces — so brand-colored text/icons stay readable no matter what color
// the admin picked.
// ---------------------------------------------------------------------------

const SETTINGS_QUERY_KEY = ['system-settings']

export async function fetchSettings(): Promise<SettingsMap> {
  const snap = await getDocs(collection(db, 'system_settings'))
  const map: SettingsMap = {}
  for (const doc of snap.docs) {
    const data = doc.data() as SystemSetting
    const key = data.key || doc.id
    map[key] = { ...data, key }
  }
  return map
}

interface SettingsContextValue {
  settings: SettingsMap
  /** True after the first successful settings load (used to avoid FOUC). */
  isLoaded: boolean
  isLoading: boolean
  isError: boolean
  /** Look up a single setting doc by key. */
  getSetting: (key: SettingKey) => SystemSetting | undefined
  /** Typed helpers for the values the UI cares about. */
  isMaintenance: boolean
  maintenanceMessage: string
  branding: BrandingValues
  /** Bookable-window config (open/close hours, slot length, closed weekdays). */
  bookingConfig: {
    openHour: number
    closeHour: number
    durationMinutes: number
    /** Weekday numbers (0=Sun … 6=Sat) that are closed for booking. */
    closedDays: number[]
    /** How many minutes before a confirmed booking the reminder fires. */
    reminderMinutes: number
    /** Optional earlier reminder: how many days before (0 = off). */
    reminderDays: number
  }
  /** Re-fetch settings from Firestore (call after admin saves). */
  refresh: () => Promise<void>
}

const SettingsContext = createContext<SettingsContextValue | null>(null)

/** Values are stored natively in Firestore, so no string parsing is needed —
 *  EXCEPT booleans: `value_type: 'boolean'` may arrive as a real boolean OR
 *  as the string "true"/"false" (legacy seeds / tooling writes). Coerce those
 *  so `Boolean("false")` never sneaks back in as true. */
function parseValue(setting: SystemSetting | undefined): string | boolean | number | number[] {
  if (!setting || setting.value === null || setting.value === undefined) return ''
  if (setting.value_type === 'boolean') {
    const v = setting.value
    return v === true || v === 'true' ? true : v === false || v === 'false' ? false : Boolean(v)
  }
  return setting.value
}

const DARK_BACKGROUND = '#0b1120' // manifest splash (must match .dark bg family)
const DARK_SURFACE = '#0e0e0e' // darkest dark-mode surface — must match globals.css .dark

export function SettingsProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const resolvedTheme = useTheme()

  const {
    data: settings = {},
    isLoading,
    isError,
  } = useQuery({
    queryKey: SETTINGS_QUERY_KEY,
    queryFn: fetchSettings,
    staleTime: Infinity, // fetch-once + cache; refresh() invalidates on admin save
    retry: 1,
  })

  // --- Apply dynamic branding the moment settings OR theme changes ----------
  useEffect(() => {
    const root = document.documentElement
    const isDark = resolvedTheme === 'dark'
    const primary = safeHex(parseValue(settings['primary_color']) as string, '#2563eb')
    const accent = safeHex(parseValue(settings['accent_color']) as string, '#f59e0b')

    // Dark mode: lift brand colors until they clear 4.5:1 on dark surfaces.
    // The admin's stored values stay untouched — only the applied CSS vars
    // are adapted, so the settings panel still shows the real pick.
    const effectivePrimary = isDark ? lightenForContrast(primary, DARK_SURFACE, 4.5) : primary
    const effectiveAccent = isDark ? lightenForContrast(accent, DARK_SURFACE, 4.5) : accent

    root.style.setProperty('--app-primary', effectivePrimary)
    root.style.setProperty('--app-primary-foreground', contrastText(effectivePrimary))
    root.style.setProperty('--app-accent', effectiveAccent)
    root.style.setProperty('--app-accent-foreground', contrastText(effectiveAccent))
    root.style.setProperty('--app-ring', effectivePrimary)

    // Neutrals: theme-managed only (globals.css defines light #fafaf8 and
    // dark #0e0e0e). Clear any legacy inline values so the theme always wins.
    root.style.removeProperty('--app-background')
    root.style.removeProperty('--app-card')
    root.style.removeProperty('--app-popover')

    // PWA install screen + browser chrome follow the brand + theme too
    applyDynamicManifest(settings, isDark ? DARK_BACKGROUND : undefined)
  }, [settings, resolvedTheme])

  const getSetting = useCallback((key: SettingKey) => settings[key], [settings])

  const isMaintenance = Boolean(parseValue(settings['maintenance_mode']))

  const branding: BrandingValues = useMemo(
    () => ({
      appName: String(parseValue(settings['app_name']) || 'Booking System'),
      logoUrl: String(parseValue(settings['logo_url']) || ''),
      logoWidth: Number(parseValue(settings['logo_width']) || 120),
      logoHeight: Number(parseValue(settings['logo_height']) || 40),
      primaryColor: safeHex(parseValue(settings['primary_color']) as string, '#2563eb'),
      backgroundColor: safeHex(parseValue(settings['background_color']) as string, '#ffffff'),
      accentColor: safeHex(parseValue(settings['accent_color']) as string, '#f59e0b'),
    }),
    [settings]
  )

  const bookingConfig = useMemo(() => {
    const open = Number(parseValue(settings['booking_open_hour']))
    const close = Number(parseValue(settings['booking_close_hour']))
    const minutes = Number(parseValue(settings['slot_duration_minutes']))
    const reminder = Number(parseValue(settings['booking_reminder_minutes']))
    const reminderDays = Number(parseValue(settings['booking_reminder_days']))
    const rawClosed = settings['booking_closed_days']?.value
    const closedDays = Array.isArray(rawClosed)
      ? rawClosed
          .map(Number)
          .filter((d) => Number.isInteger(d) && d >= 0 && d <= 6)
      : []
    return {
      openHour: Number.isFinite(open) && open >= 0 && open <= 23 ? open : 8,
      closeHour: Number.isFinite(close) && close >= 1 && close <= 24 ? close : 18,
      durationMinutes: Number.isFinite(minutes) && minutes >= 15 && minutes <= 240 ? minutes : 60,
      closedDays,
      // 15–180 min reminder lead time; default 30 to match the Cloud Function.
      reminderMinutes: Number.isFinite(reminder) && reminder >= 15 && reminder <= 180 ? reminder : 30,
      // Optional earlier reminder (0 = off, 1–7 days before).
      reminderDays: Number.isFinite(reminderDays) && reminderDays >= 0 && reminderDays <= 7 ? Math.floor(reminderDays) : 0,
    }
  }, [settings])

  const refresh = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: SETTINGS_QUERY_KEY })
  }, [queryClient])

  const value = useMemo<SettingsContextValue>(
    () => ({
      settings,
      isLoaded: Object.keys(settings).length > 0,
      isLoading,
      isError,
      getSetting,
      isMaintenance,
      maintenanceMessage:
        String(parseValue(settings['maintenance_message']) || 'We are currently performing maintenance. Please check back soon.'),
      branding,
      bookingConfig,
      refresh,
    }),
    [settings, isLoading, isError, getSetting, isMaintenance, branding, bookingConfig, refresh]
  )

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>
}

/** Consume settings anywhere in the tree. */
export function useSettings(): SettingsContextValue {
  const ctx = useContext(SettingsContext)
  if (!ctx) throw new Error('useSettings must be used within <SettingsProvider>')
  return ctx
}
