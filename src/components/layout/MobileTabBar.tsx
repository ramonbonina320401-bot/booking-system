import { NavLink } from 'react-router'
import { CalendarDays, Home, LayoutDashboard, Ticket, UserRound } from 'lucide-react'

import { useAuth } from '@/hooks/useAuth'
import { useI18n } from '@/lib/i18n'
import { cn } from '@/lib/utils'

/**
 * MobileTabBar — fixed bottom navigation for phones, native-app style.
 * Visible only below md; desktop keeps the top navbar. Safe-area padding keeps
 * the tabs clear of the iPhone home indicator.
 */
export function MobileTabBar() {
  const { isAdmin } = useAuth()
  const { t } = useI18n()

  const tabs = [
    { to: '/', label: t('nav.home'), icon: Home, end: true },
    { to: '/book', label: t('nav.book'), icon: CalendarDays },
    { to: '/my-bookings', label: t('nav.myBookings'), icon: Ticket },
  ]
  if (isAdmin) {
    tabs.push({ to: '/admin', label: t('nav.admin'), icon: LayoutDashboard })
  }
  tabs.push({ to: '/profile', label: t('nav.profile'), icon: UserRound })

  return (
    <nav
      aria-label="Bottom"
      className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 backdrop-blur md:hidden"
      style={{ borderColor: 'var(--app-border, rgba(0,0,0,0.08))' }}
    >
      <div className="mx-auto flex max-w-md items-stretch justify-around px-1 pb-[env(safe-area-inset-bottom)] pt-1">
        {tabs.map(({ to, label, icon: Icon, end }) => (
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
