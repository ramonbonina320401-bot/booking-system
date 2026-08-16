import { useI18n } from '@/lib/i18n'
import { AdminHero } from '@/components/layout/AdminHero'
import { ResourceManager } from '@/components/admin/ResourceManager'

export function AdminResourcesPage() {
  const { t } = useI18n()
  return (
    <div className="space-y-6">
      <AdminHero
        eyebrow={t('ar.administration')}
        title={t('ar.header')}
        subtitle={t('ar.subtitle')}
      />
      <ResourceManager />
    </div>
  )
}
