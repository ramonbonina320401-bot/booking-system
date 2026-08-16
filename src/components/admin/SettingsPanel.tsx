import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { AlertTriangle, Loader2, Save, X } from 'lucide-react'
import { doc, setDoc } from 'firebase/firestore'

import { db } from '@/lib/firebase'
import { logAudit } from '@/lib/audit'
import { useSettings } from '@/contexts/SettingsContext'
import { useI18n, tr } from '@/lib/i18n'
import { safeHex } from '@/lib/color'
import { useSettingsDraft } from '@/stores/useSettingsDraft'
import { registerSettingsFlusher } from '@/lib/settingsAutosave'
import { BrandPreview } from '@/components/admin/BrandPreview'
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

// ---------------------------------------------------------------------------
// SettingsPanel — full branding + maintenance admin UI.
//
// Every field edits the shared draft (useSettingsDraft); color/logo changes
// preview instantly via CSS vars + a live BrandPreview mockup. Save writes
// each key to Firestore, invalidates the settings query, and the context
// re-applies.
//
// UNSAVED-CHANGES PROTECTION:
//   - A sticky banner appears while dirty: Save now / Discard.
//   - beforeunload warns before reloading/closing the tab.
//   - On in-app navigation the AdminLayout calls flushDirtySettings(), which
//     invokes this panel's registered saver — the draft is AUTO-SAVED before
//     the route change finishes. (BrowserRouter has no useBlocker, so the
//     store + flusher bridge achieves the same effect.)
// ---------------------------------------------------------------------------

export function SettingsPanel() {
  const { settings, branding, isMaintenance, maintenanceMessage, refresh, isLoading } = useSettings()
  const { t } = useI18n()
  const [saving, setSaving] = useState(false)

  const draft = useSettingsDraft((s) => s.draft)
  const isDirty = useSettingsDraft((s) => s.isDirty)
  const updateDraft = useSettingsDraft((s) => s.update)
  const discardDraft = useSettingsDraft((s) => s.discard)
  const markClean = useSettingsDraft((s) => s.markClean)

  // Seed the store once from the saved values (keeps any failed-save draft).
  useEffect(() => {
    useSettingsDraft.getState().initialize({
      app_name: branding.appName,
      logo_url: branding.logoUrl,
      logo_width: branding.logoWidth,
      logo_height: branding.logoHeight,
      primary_color: branding.primaryColor,
      accent_color: branding.accentColor,
      maintenance_mode: isMaintenance,
      maintenance_message: maintenanceMessage,
    })
  }, [branding, isMaintenance, maintenanceMessage])

  /** Write one setting doc (native value types — Firestore supports them). */
  const saveSetting = useCallback(
    async (key: string, value: string | boolean | number, value_type: SettingValueType) => {
      await setDoc(doc(db, 'system_settings', key), { key, value, value_type, updated_at: Date.now() }, { merge: true })
    },
    []
  )

  /** Persist the whole draft. Returns true on success (used by auto-save). */
  const handleSave = useCallback(async (): Promise<boolean> => {
    const d = useSettingsDraft.getState().draft
    if (!d) return true
    // Skip redundant writes when nothing changed (auto-save fires on every
    // admin navigation once the panel has been visited).
    if (!useSettingsDraft.getState().isDirty) return true
    setSaving(true)
    try {
      await Promise.all([
        saveSetting('app_name', d.app_name, 'string'),
        saveSetting('logo_url', d.logo_url, 'image'),
        saveSetting('logo_width', Number(d.logo_width), 'number'),
        saveSetting('logo_height', Number(d.logo_height), 'number'),
        saveSetting('primary_color', safeHex(d.primary_color), 'color'),
        saveSetting('accent_color', safeHex(d.accent_color), 'color'),
        saveSetting('maintenance_mode', Boolean(d.maintenance_mode), 'boolean'),
        saveSetting('maintenance_message', d.maintenance_message, 'string'),
      ])
      await refresh() // re-fetch → context re-applies CSS vars + PWA manifest
      await logAudit({
        action: 'settings_updated',
        target_type: 'settings',
        details: `app_name=${d.app_name} colors=${safeHex(d.primary_color)}/${safeHex(d.accent_color)} maintenance=${String(d.maintenance_mode)}`,
      })
      markClean()
      toast.success(tr('st.saved'))
      return true
    } catch (err) {
      toast.error(err instanceof Error ? err.message : tr('st.saveFailed'))
      return false
    } finally {
      setSaving(false)
    }
  }, [markClean, refresh, saveSetting])

  // Register the saver so AdminLayout can flush on navigation (module-level,
  // survives this component unmounting).
  useEffect(() => {
    registerSettingsFlusher(handleSave)
  }, [handleSave])

  /** Revert the draft to the last-saved values and clear the live preview. */
  const handleDiscard = useCallback(() => {
    discardDraft({
      app_name: branding.appName,
      logo_url: branding.logoUrl,
      logo_width: branding.logoWidth,
      logo_height: branding.logoHeight,
      primary_color: branding.primaryColor,
      accent_color: branding.accentColor,
      maintenance_mode: isMaintenance,
      maintenance_message: maintenanceMessage,
    })
    // Re-apply saved colors so the live preview (CSS vars) matches.
    document.documentElement.style.setProperty('--app-primary', branding.primaryColor)
    document.documentElement.style.setProperty('--app-accent', branding.accentColor)
    toast.info(tr('st.discarded'))
  }, [branding, discardDraft, isMaintenance, maintenanceMessage])

  // beforeunload — warn before reload / tab close while dirty.
  useEffect(() => {
    if (!isDirty) return
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [isDirty])

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

  if (!draft) return null

  return (
    <div className="space-y-6">
      {/* Sticky unsaved-changes banner */}
      {isDirty && (
        <div
          role="status"
          className="sticky top-16 z-20 -mx-1 mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-primary/30 bg-primary/10 px-4 py-3 backdrop-blur-sm sm:-mx-2 sm:px-5"
        >
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
            <div>
              <p className="text-sm font-semibold">{t('st.unsavedTitle')}</p>
              <p className="text-xs text-muted-foreground">{t('st.unsavedHint')}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleDiscard} disabled={saving}>
              <X className="h-4 w-4" />
              {t('st.discard')}
            </Button>
            <Button size="sm" onClick={() => void handleSave()} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {t('st.saveNow')}
            </Button>
          </div>
        </div>
      )}

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
              onChange={(e) => updateDraft({ app_name: e.target.value })}
              maxLength={40}
            />
          </div>

          <LogoUploader
            branding={{ ...branding, logoUrl: draft.logo_url, logoWidth: draft.logo_width, logoHeight: draft.logo_height }}
            onLogoChange={(logo_url, logo_width, logo_height) =>
              updateDraft({ logo_url, logo_width, logo_height })
            }
          />

          <div className="grid gap-6 sm:grid-cols-2">
            <ColorPicker
              id="color-primary"
              label={t('st.primaryColor')}
              value={draft.primary_color}
              onChange={(primary_color) => {
                updateDraft({ primary_color })
                // live preview
                document.documentElement.style.setProperty('--app-primary', safeHex(primary_color))
              }}
            />
            <ColorPicker
              id="color-accent"
              label={t('st.accentColor')}
              value={draft.accent_color}
              onChange={(accent_color) => {
                updateDraft({ accent_color })
                document.documentElement.style.setProperty('--app-accent', safeHex(accent_color))
              }}
            />
          </div>

          {/* Live brand mockup — re-colors instantly as the admin picks */}
          <BrandPreview
            appName={draft.app_name}
            primaryColor={draft.primary_color}
            accentColor={draft.accent_color}
          />

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
              updateDraft({ maintenance_mode, maintenance_message })
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
