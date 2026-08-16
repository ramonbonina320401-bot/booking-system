/**
 * Dynamic PWA manifest.
 *
 * manifest.json is static at build time, so it can't know the brand colors /
 * name stored in the database. Workaround: once system_settings loads, we
 * build a fresh manifest object, render it to a Blob URL and swap the
 * <link rel="manifest"> href — the install prompt then uses DB values.
 * We also sync <meta name="theme-color"> for the browser chrome.
 */
import type { SettingsMap } from '@/types/settings.types'

export const APP_DEFAULT_NAME = 'Booking System'

export interface DynamicManifestInput {
  name: string
  shortName: string
  themeColor: string
  backgroundColor: string
}

export function buildManifest({ name, shortName, themeColor, backgroundColor }: DynamicManifestInput) {
  return {
    name,
    short_name: shortName,
    start_url: '/',
    display: 'standalone',
    orientation: 'portrait',
    theme_color: themeColor,
    background_color: backgroundColor,
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }
}

/**
 * Apply dynamic branding to the manifest + theme-color meta tag.
 * @param backgroundOverride  pass the dark-mode background when dark is active,
 *                            so the install/splash screen matches the theme.
 */
export function applyDynamicManifest(settings: SettingsMap, backgroundOverride?: string): void {
  const name = String(settings.app_name?.value ?? '') || APP_DEFAULT_NAME
  const themeColor = String(settings.primary_color?.value ?? '') || '#2563eb'
  const backgroundColor =
    backgroundOverride ?? (String(settings.background_color?.value ?? '') || '#ffffff')

  // 1) Swap the manifest to a dynamic Blob URL
  const manifest = buildManifest({
    name,
    shortName: name.length > 12 ? `${name.slice(0, 12)}…` : name,
    themeColor,
    backgroundColor,
  })
  try {
    const blob = new Blob([JSON.stringify(manifest)], { type: 'application/manifest+json' })
    const url = URL.createObjectURL(blob)
    let link = document.querySelector<HTMLLinkElement>('link[rel="manifest"]')
    if (!link) {
      link = document.createElement('link')
      link.rel = 'manifest'
      document.head.appendChild(link)
    }
    link.href = url
  } catch {
    // Blob URLs unsupported — static manifest stays in effect
  }

  // 2) Keep the browser chrome color in sync
  let meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')
  if (!meta) {
    meta = document.createElement('meta')
    meta.name = 'theme-color'
    document.head.appendChild(meta)
  }
  meta.content = themeColor
}
