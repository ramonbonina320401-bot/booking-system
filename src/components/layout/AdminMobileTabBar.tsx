import { NavLink } from 'react-router'
import { CalendarCheck2, LayoutDashboard, Settings2, Users, Wrench } from 'lucide-react'

import { useI18n } from '@/lib/i18n'
import { cn } from '@/lib/utils'


/**
 * AdminMobileTabBar — fixed bottom navigation for admin pages on phones
 * (the desktop icon rail stays for ≥md). Mirrors the user-side MobileTabBar
 * so both layouts feel native-app-like on mobile.
 */
export function AdminMobileTabBar() {
  const { t } = useI18n()
  const NAV_ITEMS = [
    { to: '/admin', label: t('nav.dashboard'), icon: LayoutDashboard, end: true },
    { to: '/admin/bookings', label: t('nav.bookings'), icon: CalendarCheck2 },
    { to: '/admin/resources', label: t('nav.resources'), icon: Wrench },
    { to: '/admin/users', label: t('nav.users'), icon: Users },
    { to: '/admin/settings', label: t('nav.settings'), icon: Settings2 },
  ]

  return (
    <nav
      aria-label="Bottom"
      className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 backdrop-blur md:hidden"
      style={{ borderColor: 'var(--app-border, rgba(0,0,0,0.08))' }}
    >
      <div className="mx-auto flex max-w-md items-stretch justify-around px-1 pb-[env(safe-area-inset-bottom)] pt-1">
        {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              cn(
                'flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-xl px-1 py-1.5 text-[10px] font-medium transition-colors',
                isActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
              )
            }
          >
            <Icon className="h-5 w-5" />
            <span className="truncate leading-none">{label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
