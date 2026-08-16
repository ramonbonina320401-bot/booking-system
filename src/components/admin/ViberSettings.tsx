import { useState } from 'react'
import { toast } from 'sonner'
import { CheckCircle2, ChevronDown, Eye, EyeOff, Loader2, MessageCircle, Plug, Save, XCircle } from 'lucide-react'
import { doc, setDoc } from 'firebase/firestore'

import { db } from '@/lib/firebase'
import { logAudit } from '@/lib/audit'
import { useSettings } from '@/contexts/SettingsContext'
import { useI18n, tr } from '@/lib/i18n'
import { testViberConnection } from '@/services/viber'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'

function settingValue(settings: ReturnType<typeof useSettings>['settings'], key: string, fallback: string): string {
  const v = settings[key]?.value
  return v === null || v === undefined ? fallback : String(v)
}

/**
 * ViberSettings — admin notification via Viber (REST bot API).
 *
 * Config is stored in system_settings (viber_enabled / viber_token /
 * viber_admin_id). The token is sensitive — see the note in
 * src/services/viber.ts about moving the send to a backend in production.
 */
export function ViberSettings() {
  const { settings, refresh } = useSettings()
  const { t } = useI18n()
  const [enabled, setEnabled] = useState(settingValue(settings, 'viber_enabled', '') === 'true')
  const [token, setToken] = useState(settingValue(settings, 'viber_token', ''))
  const [adminId, setAdminId] = useState(settingValue(settings, 'viber_admin_id', ''))
  const [showToken, setShowToken] = useState(false)
  const [showHelp, setShowHelp] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ ok: boolean; botName?: string; message: string } | null>(null)
  const [saving, setSaving] = useState(false)

  const save = async () => {
    setSaving(true)
    try {
      await Promise.all([
        setDoc(doc(db, 'system_settings', 'viber_enabled'), { key: 'viber_enabled', value: enabled, value_type: 'boolean', updated_at: Date.now() }, { merge: true }),
        setDoc(doc(db, 'system_settings', 'viber_token'), { key: 'viber_token', value: token.trim(), value_type: 'string', updated_at: Date.now() }, { merge: true }),
        setDoc(doc(db, 'system_settings', 'viber_admin_id'), { key: 'viber_admin_id', value: adminId.trim(), value_type: 'string', updated_at: Date.now() }, { merge: true }),
      ])
      await refresh()
      await logAudit({
        action: 'viber_settings_updated',
        target_type: 'settings',
        details: `enabled=${enabled} admin=${adminId.trim() ? 'set' : 'empty'} token=${token.trim() ? 'set' : 'empty'}`,
      })
      toast.success(tr('vb.saved'))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : tr('vb.saveFailed'))
    } finally {
      setSaving(false)
    }
  }

  const test = async () => {
    setTesting(true)
    setTestResult(null)
    try {
      const result = await testViberConnection(token)
      setTestResult(result)
      if (result.ok) toast.success(tr('vb.connected', { name: result.botName ? `: ${result.botName}` : '' }))
      else toast.error(result.message)
    } finally {
      setTesting(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageCircle className="h-5 w-5 text-primary" />
          {t('vb.title')}
        </CardTitle>
        <CardDescription>{t('vb.desc')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium">{t('vb.enable')}</p>
            <p className="text-xs text-muted-foreground">{t('vb.enableDesc')}</p>
          </div>
          <Switch checked={enabled} onCheckedChange={setEnabled} aria-label={t('vb.enableAria')} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="viber-token">{t('vb.token')}</Label>
          <div className="relative">
            <Input
              id="viber-token"
              type={showToken ? 'text' : 'password'}
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder={t('vb.tokenPlaceholder')}
              autoComplete="off"
              spellCheck={false}
            />
            <button
              type="button"
              onClick={() => setShowToken((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              aria-label={showToken ? t('vb.hideToken') : t('vb.showToken')}
            >
              {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="viber-admin-id">{t('vb.adminId')}</Label>
          <Input
            id="viber-admin-id"
            value={adminId}
            onChange={(e) => setAdminId(e.target.value)}
            placeholder={t('vb.adminIdPlaceholder')}
            autoComplete="off"
            spellCheck={false}
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => void test()} disabled={testing || !token.trim()}>
            {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plug className="h-4 w-4" />}
            {t('vb.test')}
          </Button>
          <Button type="button" size="sm" onClick={() => void save()} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {t('vb.save')}
          </Button>
        </div>

        {testResult && (
          <div
            className={`flex items-start gap-2 rounded-lg border p-3 text-sm ${
              testResult.ok ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'border-red-500/40 bg-red-500/10 text-red-600 dark:text-red-400'
            }`}
            role="status"
          >
            {testResult.ok ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /> : <XCircle className="mt-0.5 h-4 w-4 shrink-0" />}
            <span>
              {testResult.ok
                ? tr('vb.connectedLong', { name: testResult.botName ? `: ${testResult.botName}` : '' })
                : testResult.message}
            </span>
          </div>
        )}

        <div className="rounded-lg border border-border">
          <button
            type="button"
            onClick={() => setShowHelp((v) => !v)}
            className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-medium"
            aria-expanded={showHelp}
          >
            <span>{t('vb.how')}</span>
            <ChevronDown className={`h-4 w-4 transition-transform ${showHelp ? 'rotate-180' : ''}`} />
          </button>
          {showHelp && (
            <ol className="space-y-2 border-t border-border px-4 py-3 text-xs text-muted-foreground">
              <li>
                1. Gumawa ng <strong>Viber Business Account (bot)</strong> sa Viber partner dashboard — may libreng trial para sa testing.
              </li>
              <li>
                2. Kunin ang <strong>auth token</strong> ng bot (makikita sa dashboard kapag na-activate ang account).
              </li>
              <li>
                3. I-message ng admin ang bot sa Viber (i-send muna ang bot ng message sa admin) — para ma-subscribe ang admin bilang receiver.
              </li>
              <li>
                4. Kunin ang <strong>Viber user ID</strong> ng admin: i-set ang webhook sa{' '}
                <code className="rounded bg-muted px-1 py-0.5">POST /pa/set_webhook</code>, i-message ang bot, at makikita ang{' '}
                <code className="rounded bg-muted px-1 py-0.5">sender.id</code> sa webhook request.
              </li>
              <li>5. I-paste ang token at user ID dito, i-click ang Test connection, tapos i-save.</li>
            </ol>
          )}
        </div>

        <p className="text-xs text-muted-foreground">
          Tandaan: habang client-only ang app, ang token ay naka-store sa Firestore at nababasa ng app. Para sa production,
          ililipat natin ang pag-send sa backend (Cloud Function o ang planadong ASP.NET API) para hindi ma-expose ang token.
        </p>
      </CardContent>
    </Card>
  )
}
