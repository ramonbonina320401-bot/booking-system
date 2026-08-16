#!/usr/bin/env node
/**
 * generate-icons.mjs — generates the PWA icons (192, 512, maskable 512,
 * apple-touch 180) with zero dependencies, using only Node's zlib.
 *
 * Usage: node scripts/generate-icons.mjs
 *
 * The icons are simple: a rounded square in the default brand blue with a
 * white calendar glyph. Swap the PNGs under public/icons/ any time.
 */
import { deflateSync } from 'node:zlib'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const OUT = join(ROOT, 'public', 'icons')
mkdirSync(OUT, { recursive: true })

// ---- PNG encoding ---------------------------------------------------------
const CRC_TABLE = (() => {
  const table = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[n] = c >>> 0
  }
  return table
})()

function crc32(buf) {
  let c = 0xffffffff
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const typeBuf = Buffer.from(type, 'ascii')
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])))
  return Buffer.concat([len, typeBuf, data, crc])
}

function encodePng(size, pixelFn) {
  const raw = Buffer.alloc(size * (size * 4 + 1))
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0 // filter: none
    for (let x = 0; x < size; x++) {
      const [r, g, b, a] = pixelFn(x, y, size)
      const i = y * (size * 4 + 1) + 1 + x * 4
      raw[i] = r
      raw[i + 1] = g
      raw[i + 2] = b
      raw[i + 3] = a
    }
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // color type RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

// ---- Drawing helpers -------------------------------------------------------
const BRAND_BLUE = [37, 99, 235]
const WHITE = [255, 255, 255]

function inRoundedRect(x, y, size, inset, radius) {
  const x0 = inset
  const y0 = inset
  const x1 = size - inset
  const y1 = size - inset
  if (x < x0 || x >= x1 || y < y0 || y >= y1) return false
  const cx = Math.max(x0 + radius, Math.min(x, x1 - radius))
  const cy = Math.max(y0 + radius, Math.min(y, y1 - radius))
  const dx = x - cx
  const dy = y - cy
  return dx * dx + dy * dy <= radius * radius
}

function inRect(x, y, x0, y0, x1, y1) {
  return x >= x0 && x < x1 && y >= y0 && y < y1
}

/** Draw a calendar glyph: header band + two rows of "days". */
function calendarPixel(x, y, size, pad) {
  const s = size
  const bandY0 = pad
  const bandY1 = pad + s * 0.16
  if (inRect(x, y, pad, bandY0, s - pad, bandY1)) return WHITE
  // binder dots on the band
  if (inRect(x, y, s * 0.24, bandY0 + s * 0.045, s * 0.24 + s * 0.03, bandY0 + s * 0.12)) return BRAND_BLUE
  if (inRect(x, y, s * 0.72, bandY0 + s * 0.045, s * 0.72 + s * 0.03, bandY0 + s * 0.12)) return BRAND_BLUE
  // two rows of day blocks
  const rows = [
    [0.22, 0.28, 0.36, 0.43, 0.5, 0.57, 0.64],
    [0.22, 0.28, 0.36, 0.43, 0.5],
  ]
  const rowTop = [0.3, 0.56]
  const bw = s * 0.11
  const bh = s * 0.16
  for (let r = 0; r < rows.length; r++) {
    for (const cx of rows[r]) {
      const x0 = cx * s
      const y0 = rowTop[r] * s
      if (inRect(x, y, x0, y0, x0 + bw, y0 + bh)) return WHITE
    }
  }
  return null
}

// ---- Icon variants ---------------------------------------------------------
/** Standard icon: blue rounded square filling the canvas + glyph. */
function standard(size) {
  const pad = Math.max(2, size * 0.02)
  const radius = size * 0.22
  return (x, y) => {
    if (!inRoundedRect(x, y, size, 0, radius)) return [0, 0, 0, 0]
    const glyph = calendarPixel(x, y, size, pad)
    if (glyph) return [...glyph, 255]
    return [...BRAND_BLUE, 255]
  }
}

/** Maskable icon: glyph confined to the 80% safe zone, full-bleed background. */
function maskable(size) {
  const safe = size * 0.1 // 10% safe zone on each side → glyph inside 80%
  return (x, y) => {
    const glyph = calendarPixel(x, y, size, size * 0.1)
    if (glyph && x > safe && x < size - safe && y > safe && y < size - safe) return [...glyph, 255]
    return [...BRAND_BLUE, 255]
  }
}

// ---- Output -----------------------------------------------------------------
const targets = [
  { file: 'icon-192.png', size: 192, fn: standard },
  { file: 'icon-512.png', size: 512, fn: standard },
  { file: 'icon-maskable-512.png', size: 512, fn: maskable },
  { file: 'apple-touch-icon.png', size: 180, fn: standard },
]

for (const { file, size, fn } of targets) {
  const png = encodePng(size, fn(size))
  const outPath = join(OUT, file)
  writeFileSync(outPath, png)
  console.log(`✓ ${file} (${size}x${size}, ${png.length} bytes)`)
}
console.log('Icons written to public/icons/')
