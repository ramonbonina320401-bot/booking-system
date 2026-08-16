import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router'
import { LogOut, Moon, Sun, ChevronDown, User, ShieldCheck, UserRound } from 'lucide-react'

import { useAuth } from '@/hooks/useAuth'
import { usePwaInstall } from '@/hooks/usePwaInstall'
import { useSettings } from '@/contexts/SettingsContext'
import { useThemeStore } from '@/stores/useThemeStore'
import { useI18n } from '@/lib/i18n'
import { InstallAppButton, InstallAppDialog } from '@/components/layout/InstallAppButton'
import { LanguageToggle } from '@/components/layout/LanguageToggle'
import { cn } from '@/lib/utils'

function getInitials(name?: string | null, email?: string | null): string {
  const source = (name?.trim() || email?.trim() || '?').split(/\s+/)
  const first = source[0]?.[0] ?? '?'
  const second = source[1]?.[0] ?? ''
  return (first + second).toUpperCase()
}

interface UserMenuProps {
  align?: 'left' | 'right'
}

export function UserMenu({ align = 'right' }: UserMenuProps) {
  const { user, isAdmin, signOut } = useAuth()
  const { branding } = useSettings()
  const { isIOS } = usePwaInstall()
  const resolved = useThemeStore((s) => s.resolved)
  const toggleTheme = useThemeStore((s) => s.toggle)
  const { t } = useI18n()
  const isDark = resolved === 'dark'
  const navigate = useNavigate()

  const [isOpen, setIsOpen] = useState(false)
  const [showInstallHelp, setShowInstallHelp] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  const handleSignOut = async () => {
    setIsOpen(false)
    await signOut()
    navigate('/login')
  }

  // Close dropdown on outside click or ESC key press
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      document.addEventListener('keydown', handleKeyDown)
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen])

  if (!user) return null

  const displayName = user.profile?.full_name || user.email || t('role.user')
  const roleLabel = isAdmin ? t('role.admin') : t('role.user')
  const initials = getInitials(user.profile?.full_name, user.email)

  return (
    <div className="relative" ref={menuRef}>
      {/* Facebook-style Top Profile Trigger Button */}
      <button
        onClick={() => setIsOpen((prev) => !prev)}
        className={cn(
          'group flex items-center gap-1.5 rounded-full p-1 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-primary/40',
          isOpen ? 'bg-accent' : 'hover:bg-accent/80'
        )}
        aria-label="User account menu"
        aria-expanded={isOpen}
      >
        {user.profile?.avatar_url ? (
          <img
            src={user.profile.avatar_url}
            alt=""
            aria-hidden="true"
            className="h-9 w-9 rounded-full object-cover shadow-sm transition-transform group-hover:scale-105"
          />
        ) : (
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground shadow-sm transition-transform group-hover:scale-105">
            {initials}
          </div>
        )}
        <ChevronDown
          className={cn(
            'h-4 w-4 text-muted-foreground transition-transform duration-200',
            isOpen && 'rotate-180 text-foreground'
          )}
        />
      </button>

      {/* Facebook-style Profile Dropdown Menu */}
      {isOpen && (
        <div
          className={cn(
            'absolute top-12 z-50 w-80 max-w-[calc(100vw-2rem)] rounded-2xl border bg-popover/95 p-3 text-popover-foreground shadow-2xl backdrop-blur-md transition-all animate-in fade-in-0 zoom-in-95',
            align === 'right' ? 'right-0' : 'left-0'
          )}
          style={{ borderColor: 'var(--app-border, rgba(255,255,255,0.1))' }}
        >
          {/* User Profile Card Header */}
          <div className="flex items-center gap-3 rounded-xl p-2.5 transition-colors hover:bg-accent/50">
            {user.profile?.avatar_url ? (
              <img
                src={user.profile.avatar_url}
                alt=""
                aria-hidden="true"
                className="h-12 w-12 rounded-full object-cover shadow-md"
              />
            ) : (
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary text-base font-bold text-primary-foreground shadow-md">
                {initials}
              </div>
            )}
            <div className="flex-1 overflow-hidden">
              <h4 className="truncate text-sm font-semibold leading-snug">{displayName}</h4>
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                {isAdmin ? (
                  <ShieldCheck className="h-3.5 w-3.5 text-primary" />
                ) : (
                  <User className="h-3.5 w-3.5" />
                )}
                <span>{roleLabel}</span>
              </div>
            </div>
          </div>

          <div className="my-2 h-px bg-border/60" />

          {/* Profile link */}
          <button
            onClick={() => {
              setIsOpen(false)
              navigate('/profile')
            }}
            className="flex w-full items-center gap-3 rounded-xl p-2.5 text-sm font-medium transition-colors hover:bg-accent"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-secondary text-secondary-foreground">
              <UserRound className="h-4 w-4" />
            </div>
            <div className="text-left">
              <p className="text-sm font-medium">{t('menu.profile')}</p>
              <p className="text-xs text-muted-foreground">{t('menu.editNamePhone')}</p>
            </div>
          </button>

          <div className="my-2 h-px bg-border/60" />

          {/* Install app (PWA) — shows only when installable; opens native
              prompt or iOS instructions modal. showDialog=false because this
              dropdown unmounts on click — the dialog is rendered at the root
              below so it survives the close. */}
          <InstallAppButton
            variant="menu"
            onNavigate={() => setIsOpen(false)}
            showDialog={false}
            onOpenHelp={() => setShowInstallHelp(true)}
          />

          <div className="my-2 h-px bg-border/60" />

          {/* Language switcher */}
          <LanguageToggle />

          <div className="my-2 h-px bg-border/60" />

          {/* Theme Switcher Option (Facebook Display & Accessibility style) */}
          <button
            onClick={toggleTheme}
            className="flex w-full items-center justify-between rounded-xl p-2.5 text-sm font-medium transition-colors hover:bg-accent"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-secondary text-secondary-foreground">
                {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </div>
              <div className="text-left">
                <p className="text-sm font-medium">{isDark ? t('menu.lightMode') : t('menu.darkMode')}</p>
                <p className="text-xs text-muted-foreground">{t('menu.switchAppearance')}</p>
              </div>
            </div>
          </button>

          <div className="my-2 h-px bg-border/60" />

          {/* Sign Out Option (Facebook Log Out style) */}
          <button
            onClick={handleSignOut}
            className="flex w-full items-center gap-3 rounded-xl p-2.5 text-sm font-medium text-destructive transition-colors hover:bg-destructive/10"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-destructive/10 text-destructive">
              <LogOut className="h-4 w-4" />
            </div>
            <div className="text-left">
              <p className="text-sm font-semibold">{t('menu.logOut')}</p>
              <p className="text-xs text-muted-foreground">{t('menu.signOutAccount')}</p>
            </div>
          </button>
        </div>
      )}

      {/* Rendered outside the dropdown so it survives the menu closing. */}
      <InstallAppDialog
        open={showInstallHelp}
        onOpenChange={setShowInstallHelp}
        isIOS={isIOS}
        appName={branding.appName || 'this app'}
      />
    </div>
  )
}
