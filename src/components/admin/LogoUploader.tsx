import { useRef, useState } from 'react'
import { ImagePlus, Loader2, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

import { uploadLogo } from '@/lib/storage'
import { useI18n, tr } from '@/lib/i18n'
import { Button } from '@/components/ui/button'
import { LogoEditor } from '@/components/admin/LogoEditor'
import type { BrandingValues } from '@/types/settings.types'

interface LogoUploaderProps {
  branding: BrandingValues
  onLogoChange: (url: string, width: number, height: number) => void
}

/**
 * LogoUploader — upload a logo, then open a zoom/crop editor so the admin
 * frames exactly what they want. The crop derives the navbar display size
 * automatically (no manual width/height fields anymore). The cropped image is
 * stored as a base64 data URL in Firestore (free plan — no Cloud Storage).
 */
export function LogoUploader({ branding, onLogoChange }: LogoUploaderProps) {
  const { t } = useI18n()
  const fileRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [editorOpen, setEditorOpen] = useState(false)
  const [pendingSrc, setPendingSrc] = useState<string | null>(null)

  const handleFile = async (file: File | undefined) => {
    if (!file) return
    setUploading(true)
    try {
      const url = await uploadLogo(file) // validates type + size
      setPendingSrc(url)
      setEditorOpen(true)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : tr('logo.uploadFailed'))
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const handleApplyCrop = (dataUrl: string, width: number, height: number) => {
    onLogoChange(dataUrl, width, height)
    toast.success(tr('logo.cropped'))
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        {/* Live preview — display size comes from the crop, not manual inputs */}
        <div className="flex h-24 w-40 shrink-0 items-center justify-center rounded-lg border bg-muted/40 p-2">
          {branding.logoUrl ? (
            <img
              src={branding.logoUrl}
              alt={t('logo.preview')}
              className="max-h-20 max-w-full object-contain"
              style={{ width: branding.logoWidth, height: branding.logoHeight }}
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
            <Button type="button" variant="ghost" size="sm" onClick={() => onLogoChange('', 120, 40)}>
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

      <p className="text-xs text-muted-foreground">{t('logo.cropHint')}</p>

      <LogoEditor
        open={editorOpen}
        imageSrc={pendingSrc}
        onClose={() => setEditorOpen(false)}
        onApply={handleApplyCrop}
      />
    </div>
  )
}
