// ---------------------------------------------------------------------------
// Logo upload — 100% free path (no billing).
//
// Firebase Cloud Storage now requires the pay-as-you-go Blaze plan (change
// effective Oct 1, 2025), so the Spark free plan can't use it. Instead, the
// logo is read as a base64 data URL and saved into the Firestore doc
// `system_settings/logo_url` — well within Firestore's 1 MiB per-document
// limit, and it renders directly in an <img> tag.
//
// If you later upgrade to Blaze and want "proper" storage, swap this file's
// uploadLogo() for a getDownloadURL() implementation — everything else stays.
// ---------------------------------------------------------------------------

export const LOGO_MAX_SIZE_BYTES = 500 * 1024 // 500 KB — safe under the 1 MiB doc limit
export const ALLOWED_LOGO_TYPES = ['image/png', 'image/jpeg', 'image/svg+xml', 'image/webp']
/** Validate a logo file before reading it. Throws with a user-friendly message. */
export function validateLogoFile(file: File): void {
  if (!ALLOWED_LOGO_TYPES.includes(file.type)) {
    throw new Error('Invalid file type. Allowed: PNG, JPG, SVG, WEBP.')
  }
  if (file.size > LOGO_MAX_SIZE_BYTES) {
    throw new Error('File too large. Maximum size is 500 KB (Firestore limit).')
  }
}

/**
 * Read a logo file as a base64 data URL (e.g. "data:image/png;base64,...").
 * The returned string is saved to system_settings/logo_url by the panel.
 */
export function uploadLogo(file: File): Promise<string> {
  validateLogoFile(file)
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error('Could not read the image file.'))
    reader.readAsDataURL(file)
  })
}

// ---------------------------------------------------------------------------
// Avatar upload — same 100% free path as the logo (base64 on the profile doc).
// ---------------------------------------------------------------------------

export const AVATAR_MAX_SIZE_BYTES = 300 * 1024 // 300 KB — keeps profile docs light
export const ALLOWED_AVATAR_TYPES = ['image/png', 'image/jpeg', 'image/webp']

/** Validate an avatar file before reading it. Throws with a friendly message. */
export function validateAvatarFile(file: File): void {
  if (!ALLOWED_AVATAR_TYPES.includes(file.type)) {
    throw new Error('Invalid file type. Allowed: PNG, JPG, WEBP.')
  }
  if (file.size > AVATAR_MAX_SIZE_BYTES) {
    throw new Error('File too large. Maximum size is 300 KB.')
  }
}

/**
 * Read an avatar file as a base64 data URL, resized to a square thumbnail
 * so profile docs stay small and every header renders a consistent round
 * avatar. Falls back to the raw data URL if canvas processing fails.
 */
export function uploadAvatar(file: File, maxSize = 256): Promise<string> {
  validateAvatarFile(file)
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('Could not read the image file.'))
    reader.onload = () => {
      const img = new Image()
      img.onerror = () => reject(new Error('Could not decode the image file.'))
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas')
          const side = Math.min(img.width, img.height)
          const size = Math.min(maxSize, side)
          canvas.width = size
          canvas.height = size
          const ctx = canvas.getContext('2d')
          if (!ctx) throw new Error('Canvas is not available')
          // Center-crop to a square, then downscale to keep the doc tiny.
          ctx.drawImage(
            img,
            (img.width - side) / 2,
            (img.height - side) / 2,
            side,
            side,
            0,
            0,
            size,
            size
          )
          resolve(canvas.toDataURL('image/jpeg', 0.82))
        } catch {
          resolve(String(reader.result))
        }
      }
      img.src = String(reader.result)
    }
    reader.readAsDataURL(file)
  })
}
