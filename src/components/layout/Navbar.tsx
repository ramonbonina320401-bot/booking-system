import { Link, NavLink } from 'react-router'
import { CalendarDays, LayoutDashboard, LogIn, User } from 'lucide-react'

import { useAuth } from '@/hooks/useAuth'
import { useSettings } from '@/contexts/SettingsContext'
import { useI18n } from '@/lib/i18n'
import { Brand } from '@/components/layout/Brand'
import { InstallAppButton } from '@/components/layout/InstallAppButton'
import { ThemeToggle } from '@/components/layout/ThemeToggle'
import { UserMenu } from '@/components/layout/UserMenu'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const linkBase = 'rounded-full px-3 py-2 text-sm font-medium transition-colors hover:bg-accent/10'
const activeLink = 'bg-primary/10 text-primary'


export function Navbar() {
  const { user, isAdmin } = useAuth()
  const { branding } = useSettings()
  const { t } = useI18n()

  const navLinks = () => {
    const links = [
      { to: '/book', label: t('nav.book'), icon: CalendarDays },
      { to: '/my-bookings', label: t('nav.myBookings'), icon: User },
    ]
    if (isAdmin) {
      links.push({ to: '/admin', label: t('nav.admin'), icon: LayoutDashboard })
    }
    return links
  }

  return (
    <header
      className="sticky top-0 z-40 border-b bg-background/90 backdrop-blur"
      style={{ borderColor: 'var(--app-border)' }}
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4">
        <div className="flex items-center gap-3">
          <Link to="/" aria-label="Home" className="flex items-center">
            <Brand />
          </Link>
        </div>

        {/* Desktop nav */}
        <nav className="hidden items-center gap-1 md:flex" aria-label="Main">
          {navLinks().map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} className={({ isActive }) => cn(linkBase, isActive && activeLink)}>
              <Icon className="mr-1.5 inline h-4 w-4" />
              {label}
            </NavLink>
          ))}
          <span className="mx-2 h-5 w-px bg-border" aria-hidden="true" />
          {user ? (
            <div className="flex items-center gap-1">
              <InstallAppButton />
              <UserMenu />
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <InstallAppButton />
              <ThemeToggle />
              <Button asChild size="sm">
                <Link to="/login">{t('common.signIn')}</Link>
              </Button>
            </div>
          )}
        </nav>

        {/* Mobile: install + theme toggle + sign-in / avatar. No hamburger —
            the bottom tab bar already owns navigation; account actions live
            in the UserMenu (native-app pattern). */}
        <div className="flex items-center gap-1 md:hidden">
          <InstallAppButton />
          <ThemeToggle />
          {user ? (
            <UserMenu />
          ) : (
            <Button asChild size="sm">
              <Link to="/login">
                <LogIn className="h-4 w-4" />
                {t('common.signIn')}
              </Link>
            </Button>
          )}
        </div>
      </div>
      <span className="sr-only">Brand accent: {branding.appName}</span>
    </header>
  )
}
