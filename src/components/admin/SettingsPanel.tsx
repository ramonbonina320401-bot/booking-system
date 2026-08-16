import { useState } from 'react'
import { toast } from 'sonner'
import { Loader2, Save } from 'lucide-react'
import { doc, setDoc } from 'firebase/firestore'

import { db } from '@/lib/firebase'
import { logAudit } from '@/lib/audit'
import { useSettings } from '@/contexts/SettingsContext'
import { useI18n, tr } from '@/lib/i18n'
import { safeHex } from '@/lib/color'
import { ColorPicker } from '@/components/admin/ColorPicker'
import { LogoUploader } from '@/components/admin/LogoUploader'
import { MaintenanceToggle } from '@/components/admin/MaintenanceToggle'
import { BookingHoursSettings } from '@/components/admin/BookingHoursSettings'
import { ViberSettings } from '@/components/admin/ViberSettings'
import { AnnouncementsManager } from '@/components/admin/AnnouncementsManager'
import { AuditLogPanel } from '@/components/admin/AuditLogPanel'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import type { SettingValueType } from '@/types/settings.types'

/**
 * SettingsPanel — full branding + maintenance admin UI.
 *
 * Every field edits a local draft; color/logo changes preview instantly by
 * writing CSS vars directly. Save writes each key to Firestore
 * (system_settings/{key} with native values), invalidates the settings query,
 * and the SettingsContext re-applies branding from the DB — live, no reload.
 */
export function SettingsPanel() {
  const { settings, branding, isMaintenance, maintenanceMessage, refresh, isLoading } = useSettings()
  const { t } = useI18n()
  const [saving, setSaving] = useState(false)

  // Local draft
  const [draft, setDraft] = useState({
    app_name: branding.appName,
    logo_url: branding.logoUrl,
    logo_width: branding.logoWidth,
    logo_height: branding.logoHeight,
    primary_color: branding.primaryColor,
    accent_color: branding.accentColor,
    maintenance_mode: isMaintenance,
    maintenance_message: maintenanceMessage,
  })

  /** Write one setting doc (native value types — Firestore supports them). */
  const saveSetting = async (key: string, value: string | boolean | number, value_type: SettingValueType) => {
    await setDoc(doc(db, 'system_settings', key), { key, value, value_type, updated_at: Date.now() }, { merge: true })
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      await Promise.all([
        saveSetting('app_name', draft.app_name, 'string'),
        saveSetting('logo_url', draft.logo_url, 'image'),
        saveSetting('logo_width', Number(draft.logo_width), 'number'),
        saveSetting('logo_height', Number(draft.logo_height), 'number'),
        saveSetting('primary_color', safeHex(draft.primary_color), 'color'),
        saveSetting('accent_color', safeHex(draft.accent_color), 'color'),
        saveSetting('maintenance_mode', Boolean(draft.maintenance_mode), 'boolean'),
        saveSetting('maintenance_message', draft.maintenance_message, 'string'),
      ])
      await refresh() // re-fetch → context re-applies CSS vars + PWA manifest
      await logAudit({
        action: 'settings_updated',
        target_type: 'settings',
        details: `app_name=${draft.app_name} colors=${draft.primary_color}/${draft.accent_color} maintenance=${String(draft.maintenance_mode)}`,
      })
      toast.success(tr('st.saved'))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : tr('st.saveFailed'))
    } finally {
      setSaving(false)
    }
  }

  // While settings stream in from Firestore, show a skeleton form instead of
  // default-value fields that would be wrong.
  if (isLoading) {
    return (
      <div className="space-y-6" aria-busy="true">
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-32 rounded-md" />
            <Skeleton className="h-4 w-2/3 rounded-md" />
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Skeleton className="h-4 w-24 rounded-md" />
              <Skeleton className="h-10 w-full rounded-lg" />
            </div>
            <div className="flex items-center gap-4">
              <Skeleton className="h-20 w-32 rounded-xl" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-24 rounded-md" />
                <Skeleton className="h-9 w-36 rounded-full" />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="space-y-2">
                  <Skeleton className="h-4 w-28 rounded-md" />
                  <Skeleton className="h-10 w-full rounded-lg" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-36 rounded-md" />
            <Skeleton className="h-4 w-2/3 rounded-md" />
          </CardHeader>
          <CardContent className="space-y-4">
            <Skeleton className="h-9 w-full rounded-full" />
            <Skeleton className="h-20 w-full rounded-xl" />
          </CardContent>
        </Card>
        <div className="flex justify-end">
          <Skeleton className="h-11 w-44 rounded-full" />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{t('st.branding')}</CardTitle>
          <CardDescription>{t('st.brandingDesc')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="app-name">{t('st.appName')}</Label>
            <Input
              id="app-name"
              value={draft.app_name}
              onChange={(e) => setDraft((d) => ({ ...d, app_name: e.target.value }))}
              maxLength={40}
            />
          </div>

          <LogoUploader
            branding={{ ...branding, logoUrl: draft.logo_url, logoWidth: draft.logo_width, logoHeight: draft.logo_height }}
            onLogoChange={(logo_url, logo_width, logo_height) =>
              setDraft((d) => ({ ...d, logo_url, logo_width, logo_height }))
            }
          />

          <div className="grid gap-6 sm:grid-cols-2">
            <ColorPicker
              id="color-primary"
              label={t('st.primaryColor')}
              value={draft.primary_color}
              onChange={(primary_color) => {
                setDraft((d) => ({ ...d, primary_color }))
                // live preview
                document.documentElement.style.setProperty('--app-primary', safeHex(primary_color))
              }}
            />
            <ColorPicker
              id="color-accent"
              label={t('st.accentColor')}
              value={draft.accent_color}
              onChange={(accent_color) => {
                setDraft((d) => ({ ...d, accent_color }))
                document.documentElement.style.setProperty('--app-accent', safeHex(accent_color))
              }}
            />
          </div>
          <p className="text-xs text-muted-foreground">{t('st.bgNote')}</p>
          <p className="text-xs text-muted-foreground">
            {t('st.dbValues', { primary: String(settings.primary_color?.value ?? ''), accent: String(settings.accent_color?.value ?? '') })}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('st.maintenance')}</CardTitle>
          <CardDescription>{t('st.maintenanceDesc')}</CardDescription>
        </CardHeader>
        <CardContent>
          <MaintenanceToggle
            isMaintenance={draft.maintenance_mode}
            maintenanceMessage={draft.maintenance_message}
            onChange={(maintenance_mode, maintenance_message) =>
              setDraft((d) => ({ ...d, maintenance_mode, maintenance_message }))
            }
          />
        </CardContent>
      </Card>

      <BookingHoursSettings />

      <ViberSettings />

      <AnnouncementsManager />

      <AuditLogPanel />

      <div className="flex justify-end">
        <Button onClick={() => void handleSave()} disabled={saving} size="lg">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {t('st.saveAll')}
        </Button>
      </div>
    </div>
  )
}
