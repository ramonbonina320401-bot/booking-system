import { useMemo } from 'react'

import { useTheme } from '@/stores/useThemeStore'
import { safeHex, contrastText, lightenForContrast } from '@/lib/color'
import { useI18n } from '@/lib/i18n'

// ---------------------------------------------------------------------------
// BrandPreview — a miniature mockup of the public app (navbar + hero + cards)
// that re-colors INSTANTLY as the admin picks brand colors, so they see the
// real effect before saving. Mirrors the live CSS-variable logic from
// SettingsContext: dark mode lightens brand colors until they clear 4.5:1.
// ---------------------------------------------------------------------------

interface BrandPreviewProps {
  appName: string
  primaryColor: string
  accentColor: string
}

const DARK_SURFACE = '#0e0e0e'

export function BrandPreview({ appName, primaryColor, accentColor }: BrandPreviewProps) {
  const theme = useTheme()
  const { t } = useI18n()
  const isDark = theme === 'dark'

  // Same effective colors the real app applies (SettingsContext logic).
  const { primary, accent, onPrimary } = useMemo(() => {
    const p = safeHex(primaryColor, '#2563eb')
    const a = safeHex(accentColor, '#f59e0b')
    const ep = isDark ? lightenForContrast(p, DARK_SURFACE, 4.5) : p
    const ea = isDark ? lightenForContrast(a, DARK_SURFACE, 4.5) : a
    return { primary: ep, accent: ea, onPrimary: contrastText(ep) }
  }, [primaryColor, accentColor, isDark])

  return (
    <div className="rounded-2xl border border-border/60 bg-card/60 p-4 sm:p-5">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold">{t('st.previewTitle')}</p>
          <p className="text-xs text-muted-foreground">{t('st.previewDesc')}</p>
        </div>
        <span className="rounded-full border px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground">
          {isDark ? t('st.previewDark') : t('st.previewLight')}
        </span>
      </div>

      {/* Mock public app */}
      <div
        className="overflow-hidden rounded-xl border border-border/70 shadow-sm"
        style={{ background: isDark ? '#0b0b0b' : '#fafaf8' }}
      >
        {/* Mock navbar */}
        <div
          className="flex h-11 items-center justify-between border-b border-border/50 px-3"
          style={{ background: isDark ? '#0e0e0e' : '#ffffff' }}
        >
          <div className="flex items-center gap-1.5">
            <span
              className="flex h-5 w-5 items-center justify-center rounded-md text-[10px] font-bold text-white"
              style={{ background: primary }}
            >
              {(appName || 'B').charAt(0).toUpperCase()}
            </span>
            <span className="text-xs font-semibold" style={{ color: primary }}>
              {appName || 'Booking System'}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <span
              className="h-5 rounded-full px-2 text-[9px] font-semibold"
              style={{ background: primary, color: onPrimary }}
            >
              {t('st.previewBook')}
            </span>
            <span
              className="flex h-6 w-6 items-center justify-center rounded-full text-[9px] font-bold"
              style={{ background: primary, color: onPrimary }}
            >
              RU
            </span>
          </div>
        </div>

        {/* Mock hero */}
        <div className="px-3 pt-4 pb-3">
          <div
            className="relative overflow-hidden rounded-lg p-3"
            style={{
              background: `linear-gradient(115deg, ${primary} 0%, ${accent} 100%)`,
            }}
          >
            <p className="text-[9px] font-semibold uppercase tracking-widest" style={{ color: onPrimary, opacity: 0.85 }}>
              {t('st.previewWelcome')}
            </p>
            <p className="mt-0.5 text-sm font-bold leading-snug" style={{ color: onPrimary }}>
              {t('st.previewHeadline')}
            </p>
            <div className="mt-2 flex gap-1.5">
              <span
                className="rounded-full px-2.5 py-1 text-[9px] font-bold"
                style={{ background: onPrimary, color: primary }}
              >
                {t('st.previewCta')}
              </span>
              <span
                className="rounded-full border px-2.5 py-1 text-[9px] font-medium"
                style={{ borderColor: onPrimary, color: onPrimary }}
              >
                {t('st.previewSecondary')}
              </span>
            </div>
          </div>
        </div>

        {/* Mock cards row */}
        <div className="grid grid-cols-2 gap-2 px-3 pb-3">
          <div className="rounded-lg border border-border/50 p-2.5" style={{ background: isDark ? '#0e0e0e' : '#ffffff' }}>
            <span
              className="mb-1.5 block h-2.5 w-2.5 rounded-full"
              style={{ background: primary }}
            />
            <p className="text-[10px] font-semibold">{t('st.previewCardTitle')}</p>
            <p className="text-[9px] text-muted-foreground">{t('st.previewCardBody')}</p>
          </div>
          <div className="rounded-lg border border-border/50 p-2.5" style={{ background: isDark ? '#0e0e0e' : '#ffffff' }}>
            <span
              className="mb-1.5 block h-2.5 w-2.5 rounded-full"
              style={{ background: accent }}
            />
            <p className="text-[10px] font-semibold">{t('st.previewCardTitle2')}</p>
            <p className="text-[9px] text-muted-foreground">{t('st.previewCardBody2')}</p>
          </div>
        </div>
      </div>
    </div>
  )
}
