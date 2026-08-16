/**
 * Color helpers for dynamic branding.
 *
 * The primary/accent colors are stored in the DB as hex strings. We compute a
 * readable foreground (white vs near-black) by picking whichever yields the
 * higher WCAG contrast ratio — so pastel brand colors (e.g. periwinkle) get
 * dark text and deep colors get white text.
 *
 * Dark mode: brand colors are LIGHTENED in HSL until they reach a WCAG target
 * contrast against the dark surfaces, so `text-primary` links and icons never
 * sink below readability no matter what color the admin picked.
 */

/** Convert a #rrggbb / #rgb hex string to { r, g, b } 0-255. */
export function hexToRgb(hex: string): { r: number; g: number; b: number } {
  let h = hex.replace('#', '').trim()
  if (h.length === 3) {
    h = h
      .split('')
      .map((c) => c + c)
      .join('')
  }
  if (!/^[0-9a-fA-F]{6}$/.test(h)) return { r: 156, g: 163, b: 245 } // fallback: periwinkle
  const num = parseInt(h, 16)
  return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 }
}

/** Relative luminance per WCAG (0–1). */
export function luminance(hex: string): number {
  const { r, g, b } = hexToRgb(hex)
  const lin = (v: number) => {
    const s = v / 255
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
  }
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)
}

/** WCAG contrast ratio (1–21) between two hex colors. */
export function contrastRatio(a: string, b: string): number {
  const la = luminance(a)
  const lb = luminance(b)
  const [hi, lo] = la >= lb ? [la, lb] : [lb, la]
  return (hi + 0.05) / (lo + 0.05)
}

/** Return white or near-black, whichever has the higher contrast ratio. */
export function contrastText(hex: string): string {
  const L = luminance(hex)
  const whiteRatio = 1.05 / (L + 0.05)
  // Near-black (#0a0a0a) — darker than slate so it also clears 4.5:1 against
  // the dark-mode lightened brand colors (e.g. #4177ee at 4.81:1).
  const darkRatio = (L + 0.05) / 0.053
  return whiteRatio >= darkRatio ? '#ffffff' : '#0a0a0a'
}

/** Validate that a string is a hex color, else return the fallback. */
export function safeHex(value: string | null | undefined, fallback = '#9ca3f5'): string {
  if (value && /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(value)) return value
  return fallback
}

/** RGB 0-255 → HSL (h 0-360, s/l 0-1). */
function rgbToHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
  const rn = r / 255
  const gn = g / 255
  const bn = b / 255
  const max = Math.max(rn, gn, bn)
  const min = Math.min(rn, gn, bn)
  const l = (max + min) / 2
  const d = max - min
  let h = 0
  let s = 0
  if (d !== 0) {
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    switch (max) {
      case rn:
        h = ((gn - bn) / d + (gn < bn ? 6 : 0)) * 60
        break
      case gn:
        h = ((bn - rn) / d + 2) * 60
        break
      default:
        h = ((rn - gn) / d + 4) * 60
    }
  }
  return { h, s, l }
}

/** HSL → #rrggbb. */
function hslToHex(h: number, s: number, l: number): string {
  const c = (1 - Math.abs(2 * l - 1)) * s
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = l - c / 2
  let r = 0
  let g = 0
  let b = 0
  if (h < 60) [r, g, b] = [c, x, 0]
  else if (h < 120) [r, g, b] = [x, c, 0]
  else if (h < 180) [r, g, b] = [0, c, x]
  else if (h < 240) [r, g, b] = [0, x, c]
  else if (h < 300) [r, g, b] = [x, 0, c]
  else [r, g, b] = [c, 0, x]
  const to = (v: number) =>
    Math.round((v + m) * 255)
      .toString(16)
      .padStart(2, '0')
  return `#${to(r)}${to(g)}${to(b)}`
}

/**
 * Lighten `hex` (raising HSL lightness in steps, preserving hue) until it
 * reaches at least `target` contrast against `bg`. Returns the original color
 * unchanged if it already passes. Never returns below the target — clamps at
 * white as the last resort.
 */
export function lightenForContrast(hex: string, bg: string, target = 4.5): string {
  if (contrastRatio(hex, bg) >= target) return hex
  const { h, s, l } = rgbToHsl(hexToRgb(hex).r, hexToRgb(hex).g, hexToRgb(hex).b)
  let current = l
  while (current < 1) {
    current = Math.min(1, current + 0.02)
    const candidate = hslToHex(h, s, current)
    if (contrastRatio(candidate, bg) >= target) return candidate
  }
  return '#ffffff'
}
