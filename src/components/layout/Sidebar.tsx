import { NavLink, useNavigate } from 'react-router'
import {
  CalendarCheck2,
  LayoutDashboard,
  LogOut,
  Settings2,
  Users,
  Wrench,
} from 'lucide-react'

import { useAuth } from '@/hooks/useAuth'
import { useSettings } from '@/contexts/SettingsContext'
import { useUIStore } from '@/stores/useUIStore'
import { useI18n } from '@/lib/i18n'
import { ThemeToggle } from '@/components/layout/ThemeToggle'
import { cn } from '@/lib/utils'


function initialsOf(name?: string | null, fallback?: string | null): string {
  const source = (name?.trim() || fallback?.trim() || '?').split(/\s+/)
  const first = source[0]?.[0] ?? '?'
  const second = source[1]?.[0] ?? ''
  return (first + second).toUpperCase()
}

const railItem =
  'flex h-11 w-11 items-center justify-center rounded-full transition-colors ' +
  'text-sidebar-foreground/60 hover:bg-white/10 hover:text-sidebar-foreground ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40'

/**
 * Dark icon rail (76px) — the reference design's signature.
 * Desktop: icon-only with tooltips. Mobile: slide-in drawer with labels.
 */
export function Sidebar() {
  const { mobileNavOpen, setMobileNavOpen } = useUIStore()
  const { user, signOut } = useAuth()
  const { branding } = useSettings()
  const { t } = useI18n()
  const navigate = useNavigate()

  const NAV_ITEMS = [
    { to: '/admin', label: t('nav.dashboard'), icon: LayoutDashboard, end: true },
    { to: '/admin/bookings', label: t('nav.bookings'), icon: CalendarCheck2 },
    { to: '/admin/resources', label: t('nav.resources'), icon: Wrench },
    { to: '/admin/users', label: t('nav.users'), icon: Users },
    { to: '/admin/settings', label: t('nav.settings'), icon: Settings2 },
  ]

  const handleSignOut = async () => {
    await signOut()
    navigate('/login')
  }

  const compactBrand = branding.logoUrl ? (
    <img
      src={branding.logoUrl}
      alt={`${branding.appName} logo`}
      className="h-9 w-9 rounded-full object-contain"
    />
  ) : (
    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/90 text-sm font-bold text-primary-foreground">
      {branding.appName.charAt(0).toUpperCase()}
    </span>
  )

  const avatarBadge = user?.profile?.avatar_url ? (
    <img
      src={user.profile.avatar_url}
      alt=""
      aria-hidden="true"
      className="h-9 w-9 shrink-0 rounded-full object-cover ring-2 ring-white/15"
    />
  ) : (
    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/10 text-sm font-semibold text-sidebar-foreground">
      {initialsOf(user?.profile?.full_name, user?.email)}
    </span>
  )

  const themeToggle = (
    <ThemeToggle className="text-sidebar-foreground/60 hover:bg-white/10 hover:text-sidebar-foreground" />
  )

  return (
    <>
      {/* Desktop rail */}
      <aside className="sticky top-0 hidden h-dvh w-[76px] shrink-0 flex-col items-center border-r border-white/10 bg-sidebar py-4 md:flex">
        <NavLink to="/" title={t('nav.home')} aria-label={t('nav.home')}>
          {compactBrand}
        </NavLink>
        <nav aria-label="Admin" className="mt-4 flex flex-1 flex-col items-center gap-3 overflow-y-auto">
          {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              title={label}
              aria-label={label}
              className={({ isActive }) =>
                cn(railItem, isActive && 'bg-[#3a3a3a] text-white hover:bg-[#3a3a3a] hover:text-white')
              }
            >
              <Icon className="h-5 w-5" />
            </NavLink>
          ))}
        </nav>
        <div className="flex flex-col items-center gap-2">
          {themeToggle}
          {avatarBadge}
          <button
            type="button"
            onClick={() => void handleSignOut()}
            title={t('common.signOut')}
            aria-label={t('common.signOut')}
            className={cn(railItem, 'h-10 w-10')}
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </aside>

      {/* Mobile drawer */}
      {mobileNavOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <button
            className="absolute inset-0 bg-black/50"
            aria-label={t('common.close')}
            onClick={() => setMobileNavOpen(false)}
          />
          <div className="absolute left-0 top-0 h-full w-64 bg-sidebar shadow-xl">
            <div className="flex h-full flex-col">
              <div className="flex h-16 items-center border-b border-white/10 px-5">
                {compactBrand}
                <span className="ml-3 text-sm font-bold text-sidebar-foreground">{branding.appName}</span>
              </div>
              <nav aria-label="Admin" className="flex-1 space-y-1 p-3">
                {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
                  <NavLink
                    key={to}
                    to={to}
                    end={end}
                    onClick={() => setMobileNavOpen(false)}
                    className={({ isActive }) =>
                      cn(
                        'flex items-center gap-3 rounded-full px-4 py-2.5 text-sm font-medium transition-colors',
                        'text-sidebar-foreground/70 hover:bg-white/10 hover:text-sidebar-foreground',
                        isActive && 'bg-[#3a3a3a] text-white hover:bg-[#3a3a3a]'
                      )
                    }
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    {label}
                  </NavLink>
                ))}
              </nav>
              <div className="border-t border-white/10 p-3">
                <div className="mb-2 flex items-center gap-3 px-2 py-1">
                  {avatarBadge}
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-sidebar-foreground">
                      {user?.profile?.full_name ?? user?.email}
                    </p>
                    <p className="truncate text-xs capitalize text-sidebar-foreground/50">
                      {user?.profile?.role === 'admin' ? t('role.admin') : user?.profile?.role === 'user' ? t('role.user') : t('role.guest')}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  {themeToggle}
                  <button
                    type="button"
                    onClick={() => void handleSignOut()}
                    className="flex h-10 flex-1 items-center justify-center gap-1.5 rounded-full text-sm font-medium text-sidebar-foreground/70 transition-colors hover:bg-white/10 hover:text-sidebar-foreground"
                  >
                    <LogOut className="h-4 w-4" /> {t('common.signOut')}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
