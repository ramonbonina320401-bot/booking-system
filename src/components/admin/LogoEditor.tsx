import { useCallback, useState } from 'react'
import Cropper from 'react-easy-crop'
import type { Area, Point } from 'react-easy-crop'
import { Check, Loader2, ZoomIn, ZoomOut } from 'lucide-react'
import { toast } from 'sonner'

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { useI18n } from '@/lib/i18n'
import { cn } from '@/lib/utils'

// ---------------------------------------------------------------------------
// LogoEditor — a small crop/zoom editor that opens after a logo upload.
//
//   - Drag to position, zoom slider to frame, aspect presets (Free / 3:1 / 1:1).
//   - "Apply crop" rasterizes the selection to a PNG data URL (Firestore-safe)
//     and derives the navbar display size automatically — the admin no longer
//     types width/height by hand (that was the confusing part before).
// ---------------------------------------------------------------------------

interface LogoEditorProps {
  open: boolean
  imageSrc: string | null
  onClose: () => void
  /** dataUrl + display size for the navbar (max 300w × 40h, aspect kept). */
  onApply: (dataUrl: string, width: number, height: number) => void
}

type AspectKey = 'free' | 'wide' | 'square'

const ASPECTS: Record<AspectKey, number | undefined> = {
  free: undefined, // free-form crop box
  wide: 3 / 1, // navbar banner
  square: 1, // icon
}

/** Longest side of the stored (cropped) image — keeps the Firestore doc small
 *  while staying crisp on retina. */
const OUTPUT_MAX = 600
/** Display caps for the navbar (Brand renders with these). */
const DISPLAY_MAX_W = 300
const DISPLAY_MAX_H = 40
/** Approx. base64 char budget (bytes × 4/3) — shrink if we exceed ~470 KB. */
const MAX_DATAURL_LEN = 640_000

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Could not decode the image.'))
    img.src = src
  })
}

/** Draw the crop selection to a canvas, downscaled to OUTPUT_MAX on the longest
 *  side. Retries with a smaller output if the data URL would bust the size
 *  budget (base64 is ~4/3 the byte size). */
async function getCroppedImage(
  src: string,
  area: Area
): Promise<{ dataUrl: string; width: number; height: number }> {
  const img = await loadImage(src)
  let scale = Math.min(1, OUTPUT_MAX / Math.max(area.width, area.height))

  for (let attempt = 0; attempt < 3; attempt++) {
    const outW = Math.max(1, Math.round(area.width * scale))
    const outH = Math.max(1, Math.round(area.height * scale))
    const canvas = document.createElement('canvas')
    canvas.width = outW
    canvas.height = outH
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Canvas is not available.')
    // White-underlay first so transparent areas keep transparency (PNG alpha
    // stays intact — drawImage does not flatten it).
    ctx.drawImage(img, area.x, area.y, area.width, area.height, 0, 0, outW, outH)
    const dataUrl = canvas.toDataURL('image/png')

    if (dataUrl.length <= MAX_DATAURL_LEN) {
      // Display size: fit within 300×40 while preserving the crop's aspect.
      const disp = Math.min(1, DISPLAY_MAX_W / outW, DISPLAY_MAX_H / outH)
      return {
        dataUrl,
        width: Math.max(1, Math.round(outW * disp)),
        height: Math.max(1, Math.round(outH * disp)),
      }
    }
    // Too big — halve the output and retry.
    scale = Math.max(0.1, scale / 2)
  }
  throw new Error('Cropped logo is too large — try a smaller area.')
}

export function LogoEditor({ open, imageSrc, onClose, onApply }: LogoEditorProps) {
  const { t } = useI18n()
  const [crop, setCrop] = useState<Point>({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [aspectKey, setAspectKey] = useState<AspectKey>('wide')
  const [area, setArea] = useState<Area | null>(null)
  const [applying, setApplying] = useState(false)

  const aspect = ASPECTS[aspectKey]

  const onCropComplete = useCallback((_croppedArea: Area, croppedAreaPixels: Area) => {
    setArea(croppedAreaPixels)
  }, [])

  const handleApply = async () => {
    if (!imageSrc || !area) return
    setApplying(true)
    try {
      const result = await getCroppedImage(imageSrc, area)
      onApply(result.dataUrl, result.width, result.height)
      onClose()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not crop the image.')
    } finally {
      setApplying(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && !applying && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('logo.cropTitle')}</DialogTitle>
          <DialogDescription>{t('logo.cropDesc')}</DialogDescription>
        </DialogHeader>

        {imageSrc && (
          <div className="space-y-4">
            {/* Cropper canvas — must have a sized, relative, overflow-hidden parent */}
            <div className="relative h-72 w-full overflow-hidden rounded-2xl border bg-black/70">
              <Cropper
                image={imageSrc}
                crop={crop}
                zoom={zoom}
                aspect={aspect}
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onCropComplete={onCropComplete}
              />
            </div>

            {/* Aspect presets */}
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="mr-1 text-xs font-semibold text-muted-foreground">{t('logo.aspect')}</span>
              {(['free', 'wide', 'square'] as AspectKey[]).map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setAspectKey(k)}
                  className={cn(
                    'rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
                    aspectKey === k
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'text-muted-foreground hover:bg-muted'
                  )}
                >
                  {k === 'free' ? t('logo.aspectFree') : k === 'wide' ? t('logo.aspectWide') : t('logo.aspectSquare')}
                </button>
              ))}
            </div>

            {/* Zoom slider */}
            <div className="flex items-center gap-2">
              <ZoomOut className="h-4 w-4 shrink-0 text-muted-foreground" />
              <input
                type="range"
                min={1}
                max={3}
                step={0.01}
                value={zoom}
                onChange={(e) => setZoom(Number(e.target.value))}
                aria-label={t('logo.zoom')}
                className="h-2 flex-1 cursor-pointer accent-[var(--app-primary)]"
              />
              <ZoomIn className="h-4 w-4 shrink-0 text-muted-foreground" />
            </div>

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={onClose} disabled={applying}>
                {t('common.cancel')}
              </Button>
              <Button type="button" onClick={() => void handleApply()} disabled={applying || !area}>
                {applying ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                {t('logo.applyCrop')}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
