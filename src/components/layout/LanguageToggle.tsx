import { Languages } from 'lucide-react'

import { useI18n, langLabel } from '@/lib/i18n'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface LanguageToggleProps {
  /** 'menu' = full-width row for the UserMenu dropdown. 'pill' = compact chip (login page). */
  variant?: 'menu' | 'pill'
  className?: string
}

/**
 * LanguageToggle — switches the whole app between English and Filipino.
 * 'menu' is the Facebook-style dropdown row (used in UserMenu); 'pill' is a
 * compact chip used on the login page where there is no user menu yet.
 */
export function LanguageToggle({ variant = 'menu', className }: LanguageToggleProps) {
  const { lang, toggle, t } = useI18n()

  if (variant === 'pill') {
    return (
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={toggle}
        aria-label={t('menu.switchLanguage')}
        title={t('menu.switchLanguage')}
        className={cn('rounded-full', className)}
      >
        <Languages className="h-4 w-4" />
        {langLabel(lang)}
      </Button>
    )
  }

  return (
    <button
      type="button"
      onClick={toggle}
      className="flex w-full items-center gap-3 rounded-xl p-2.5 text-sm font-medium transition-colors hover:bg-accent"
    >
      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-secondary text-secondary-foreground">
        <Languages className="h-4 w-4" />
      </div>
      <div className="text-left">
        <p className="text-sm font-medium">{t('menu.language')}</p>
        <p className="text-xs text-muted-foreground">{t('menu.languageHint')}</p>
      </div>
      <span className="ml-auto rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-bold text-primary">
        {langLabel(lang)}
      </span>
    </button>
  )
}
