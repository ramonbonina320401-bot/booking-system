import { useI18n } from '@/lib/i18n'
import { AdminHero } from '@/components/layout/AdminHero'
import { SettingsPanel } from '@/components/admin/SettingsPanel'

export function AdminSettingsPage() {
  const { t } = useI18n()
  return (
    <div className="space-y-6">
      <AdminHero
        eyebrow={t('st.administration')}
        title={t('st.header')}
        subtitle={t('st.subtitle')}
      />
      <SettingsPanel />
    </div>
  )
}
