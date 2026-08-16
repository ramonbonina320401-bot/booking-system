import { useSettings } from '@/contexts/SettingsContext'
import { cn } from '@/lib/utils'

/**
 * Brand — renders the DB-configured logo (with live width/height) when one is
 * uploaded, otherwise falls back to the app name in the primary color.
 * Nothing here is hardcoded: every value comes from system_settings.
 */
export function Brand({ className, textClassName }: { className?: string; textClassName?: string }) {
  const { branding } = useSettings()
  const { logoUrl, logoWidth, logoHeight, appName } = branding

  if (logoUrl) {
    return (
      <img
        src={logoUrl}
        alt={`${appName} logo`}
        width={logoWidth}
        height={logoHeight}
        className={cn('object-contain', className)}
        style={{ width: logoWidth, height: logoHeight, maxWidth: 300, maxHeight: 40 }}
      />
    )
  }

  return (
    <span className={cn('text-lg font-bold text-primary', textClassName)}>{appName}</span>
  )
}
