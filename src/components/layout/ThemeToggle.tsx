import { Moon, Sun } from 'lucide-react'

import { useThemeStore } from '@/stores/useThemeStore'
import { useI18n } from '@/lib/i18n'
import { Button } from '@/components/ui/button'

interface ThemeToggleProps {
  /** Extra classes (e.g. light icon colors when placed on the dark sidebar). */
  className?: string
}

/**
 * ThemeToggle — flips between light and dark mode.
 * The initial preference comes from the OS (or localStorage); toggling stores
 * an explicit choice. Brand colors are preserved in both modes.
 */
export function ThemeToggle({ className }: ThemeToggleProps) {
  const resolved = useThemeStore((s) => s.resolved)
  const toggle = useThemeStore((s) => s.toggle)
  const { t } = useI18n()
  const isDark = resolved === 'dark'
  const label = isDark ? t('theme.toLight') : t('theme.toDark')

  return (
    <Button
      variant="ghost"
      size="icon"
      className={className}
      onClick={toggle}
      aria-label={label}
      title={label}
    >
      {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </Button>
  )
}
