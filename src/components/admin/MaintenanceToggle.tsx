import { useState } from 'react'
import { Hammer } from 'lucide-react'

import { useI18n } from '@/lib/i18n'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

interface MaintenanceToggleProps {
  isMaintenance: boolean
  maintenanceMessage: string
  onChange: (isMaintenance: boolean, message: string) => void
}

/**
 * MaintenanceToggle — on/off switch + the message shown to non-admin users.
 * Changes are previewed locally and persisted when the panel is saved, so the
 * admin always stays able to turn the mode back off.
 */
export function MaintenanceToggle({ isMaintenance, maintenanceMessage, onChange }: MaintenanceToggleProps) {
  const { t } = useI18n()
  const [enabled, setEnabled] = useState(isMaintenance)
  const [message, setMessage] = useState(maintenanceMessage)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Hammer className="h-4 w-4 text-accent" />
            <Label htmlFor="maintenance-switch" className="text-base">
              {t('mt.mode')}
            </Label>
          </div>
          <p className="text-sm text-muted-foreground">{t('mt.desc')}</p>
        </div>
        <Switch
          id="maintenance-switch"
          checked={enabled}
          onCheckedChange={(checked) => {
            setEnabled(checked)
            onChange(checked, message)
          }}
        />
      </div>

      {enabled && (
        <div className="space-y-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3">
          <Label htmlFor="maintenance-message">{t('mt.message')}</Label>
          <Textarea
            id="maintenance-message"
            value={message}
            onChange={(e) => {
              setMessage(e.target.value)
              onChange(true, e.target.value)
            }}
            rows={3}
          />
          <p className="text-xs text-muted-foreground">
            {t('mt.shownTo')}
          </p>
        </div>
      )}
    </div>
  )
}
