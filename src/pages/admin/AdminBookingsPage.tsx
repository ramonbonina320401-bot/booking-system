import { useI18n } from '@/lib/i18n'
import { AdminHero } from '@/components/layout/AdminHero'
import { BookingManager } from '@/components/admin/BookingManager'

export function AdminBookingsPage() {
  const { t } = useI18n()
  return (
    <div className="space-y-6">
      <AdminHero
        eyebrow={t('ab.administration')}
        title={t('ab.header')}
        subtitle={t('ab.subtitle')}
      />
      <BookingManager />
    </div>
  )
}
