import { useRef, useState } from 'react'
import { ImagePlus, Loader2, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

import { uploadLogo, validateLogoSize, LOGO_MAX_SIZE, LOGO_MIN_SIZE } from '@/lib/storage'
import { useI18n, tr } from '@/lib/i18n'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { BrandingValues } from '@/types/settings.types'

interface LogoUploaderProps {
  branding: BrandingValues
  onLogoChange: (url: string, width: number, height: number) => void
}

/**
 * LogoUploader — reads the logo as a base64 data URL (stored in Firestore,
 * no paid Storage needed), validates type/size, previews live with the
 * configured width/height, and constrains dimensions to 40–300px.
 */
export function LogoUploader({ branding, onLogoChange }: LogoUploaderProps) {
  const { t } = useI18n()
  const fileRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [width, setWidth] = useState(branding.logoWidth)
  const [height, setHeight] = useState(branding.logoHeight)

  const handleFile = async (file: File | undefined) => {
    if (!file) return
    setUploading(true)
    try {
      const url = await uploadLogo(file)
      onLogoChange(url, width, height)
      toast.success(tr('logo.loaded'))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : tr('logo.uploadFailed'))
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const handleSize = (dim: 'width' | 'height', value: number) => {
    try {
      validateLogoSize(
        dim === 'width' ? value : width,
        dim === 'height' ? value : height
      )
    } catch {
      toast.error(tr('logo.sizeError'))
      return
    }
    if (dim === 'width') setWidth(value)
    else setHeight(value)
    onLogoChange(branding.logoUrl, dim === 'width' ? value : width, dim === 'height' ? value : height)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        {/* Live preview */}
        <div className="flex h-24 w-40 items-center justify-center rounded-lg border bg-muted/40 p-2">
          {branding.logoUrl ? (
            <img
              src={branding.logoUrl}
              alt={t('logo.preview')}
              className="max-h-20 max-w-full object-contain"
              style={{ width, height }}
            />
          ) : (
            <span className="text-xs text-muted-foreground">{t('logo.none')}</span>
          )}
        </div>
        <div className="space-y-2">
          <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()} disabled={uploading}>
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
            {branding.logoUrl ? t('logo.replace') : t('logo.upload')}
          </Button>
          {branding.logoUrl && (
            <Button type="button" variant="ghost" size="sm" onClick={() => onLogoChange('', width, height)}>
              <Trash2 className="h-4 w-4" /> {t('logo.remove')}
            </Button>
          )}
          <p className="text-xs text-muted-foreground">{t('logo.sizeNote')}</p>
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/svg+xml,image/webp"
            className="sr-only"
            onChange={(e) => void handleFile(e.target.files?.[0])}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="logo-width">{t('logo.width')}</Label>
          <Input
            id="logo-width"
            type="number"
            min={LOGO_MIN_SIZE}
            max={LOGO_MAX_SIZE}
            value={width}
            onChange={(e) => handleSize('width', Number(e.target.value))}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="logo-height">{t('logo.height')}</Label>
          <Input
            id="logo-height"
            type="number"
            min={LOGO_MIN_SIZE}
            max={LOGO_MAX_SIZE}
            value={height}
            onChange={(e) => handleSize('height', Number(e.target.value))}
          />
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        {t('logo.sizeHint', { min: LOGO_MIN_SIZE, max: LOGO_MAX_SIZE })}
      </p>
    </div>
  )
}
