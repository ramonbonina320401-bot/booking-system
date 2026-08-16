import { Menu } from 'lucide-react'

import { useUIStore } from '@/stores/useUIStore'
import { useI18n } from '@/lib/i18n'
import { AdminNotificationBell } from '@/components/layout/AdminNotificationBell'
import { UserMenu } from '@/components/layout/UserMenu'
import { Button } from '@/components/ui/button'

/** Sticky top bar for the admin shell — mobile menu, user menu. */
export function AdminHeader() {
  const { toggleMobileNav } = useUIStore()
  const { t } = useI18n()

  return (
    <header className="sticky top-0 z-30 flex h-16 w-full items-center justify-between gap-3 border-b bg-background/80 px-4 backdrop-blur sm:px-6">
      <Button variant="ghost" size="icon" className="md:hidden" onClick={toggleMobileNav} aria-label={t('common.openMenu')}>
        <Menu className="h-5 w-5" />
      </Button>

      <div className="ml-auto flex items-center gap-2">
        <AdminNotificationBell />
        <UserMenu />
      </div>
    </header>
  )
}
