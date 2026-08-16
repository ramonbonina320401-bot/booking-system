import { AlertTriangle, Loader2 } from 'lucide-react'

import { useI18n } from '@/lib/i18n'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

interface ConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: string
  confirmLabel?: string
  cancelLabel?: string
  tone?: 'destructive' | 'default'
  loading?: boolean
  onConfirm: () => void
}

/**
 * ConfirmDialog — branded replacement for window.confirm().
 *
 * Uses the same Radix dialog + theme tokens as the rest of the app, so the
 * destructive/confirm flows no longer pop the OS-level browser box.
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  cancelLabel,
  tone = 'destructive',
  loading = false,
  onConfirm,
}: ConfirmDialogProps) {
  const { t } = useI18n()
  const resolvedConfirm = confirmLabel ?? t('common.confirm')
  const resolvedCancel = cancelLabel ?? t('common.cancel')
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive sm:mx-0">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <DialogTitle className="text-center sm:text-left">{title}</DialogTitle>
          <DialogDescription className="text-center sm:text-left">{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            {resolvedCancel}
          </Button>
          <Button
            variant={tone === 'destructive' ? 'destructive' : 'default'}
            onClick={onConfirm}
            disabled={loading}
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {resolvedConfirm}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
