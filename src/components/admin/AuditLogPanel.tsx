import { format } from 'date-fns'
import {
  Ban,
  CalendarX2,
  History,
  Megaphone,
  MessageCircle,
  Package,
  RotateCcw,
  Settings2,
  ShieldCheck,
  ShieldX,
  Trash2,
} from 'lucide-react'

import { useI18n } from '@/lib/i18n'
import { useAuditLog } from '@/hooks/useAuditLog'
import type { AuditAction } from '@/lib/audit'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { Skeleton } from '@/components/ui/skeleton'

function actionMeta(action: AuditAction) {
  switch (action) {
    case 'role_changed':
      return { icon: ShieldX, labelKey: 'audit.roleChanged', tone: 'default' as const }
    case 'user_deactivated':
      return { icon: Ban, labelKey: 'audit.userDeactivated', tone: 'destructive' as const }
    case 'user_reactivated':
      return { icon: RotateCcw, labelKey: 'audit.userReactivated', tone: 'default' as const }
    case 'booking_status_changed':
      return { icon: CalendarX2, labelKey: 'audit.bookingStatusChanged', tone: 'default' as const }
    case 'booking_deleted':
      return { icon: Trash2, labelKey: 'audit.bookingDeleted', tone: 'destructive' as const }
    case 'announcement_created':
      return { icon: Megaphone, labelKey: 'audit.announcementCreated', tone: 'default' as const }
    case 'announcement_deleted':
      return { icon: Trash2, labelKey: 'audit.announcementDeleted', tone: 'destructive' as const }
    case 'resource_created':
      return { icon: Package, labelKey: 'audit.resourceCreated', tone: 'default' as const }
    case 'resource_updated':
      return { icon: Package, labelKey: 'audit.resourceUpdated', tone: 'default' as const }
    case 'resource_deleted':
      return { icon: Trash2, labelKey: 'audit.resourceDeleted', tone: 'destructive' as const }
    case 'settings_updated':
      return { icon: Settings2, labelKey: 'audit.settingsUpdated', tone: 'default' as const }
    case 'booking_hours_updated':
      return { icon: Settings2, labelKey: 'audit.hoursUpdated', tone: 'default' as const }
    case 'viber_settings_updated':
      return { icon: MessageCircle, labelKey: 'audit.viberUpdated', tone: 'default' as const }
    default:
      return { icon: ShieldCheck, labelKey: 'audit.generic', tone: 'default' as const }
  }
}

function timeAgo(ms: number): string {
  if (!ms) return '—'
  const diff = Date.now() - ms
  if (diff < 60_000) return 'now'
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`
  return format(new Date(ms), 'MMM d, h:mm a')
}

/** Admin-only audit trail — who changed what and when (immutable records). */
export function AuditLogPanel() {
  const { t } = useI18n()
  const { data: entries, isLoading, refetch } = useAuditLog()

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-4 space-y-0">
        <div>
          <CardTitle className="flex items-center gap-2">
            <History className="h-4 w-4 text-primary" aria-hidden="true" />
            {t('audit.title')}
          </CardTitle>
          <CardDescription>{t('audit.desc')}</CardDescription>
        </div>
        <Button variant="outline" size="sm" onClick={() => void refetch()}>
          {t('audit.refresh')}
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3" aria-busy="true">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full rounded-xl" />
            ))}
          </div>
        ) : !entries || entries.length === 0 ? (
          <EmptyState
            compact
            icon={History}
            title={t('audit.emptyTitle')}
            description={t('audit.emptyDesc')}
          />
        ) : (
          <ul className="max-h-96 space-y-2 overflow-y-auto pr-1">
            {entries.map((entry) => {
              const meta = actionMeta(entry.action)
              const Icon = meta.icon
              return (
                <li
                  key={entry.id}
                  className="flex items-start gap-3 rounded-xl border border-border bg-muted/30 px-3 py-2.5"
                >
                  <span
                    className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                      meta.tone === 'destructive' ? 'bg-destructive/10 text-destructive' : 'bg-primary/10 text-primary'
                    }`}
                  >
                    <Icon className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                      <span className="text-sm font-medium">{t(meta.labelKey)}</span>
                      <Badge variant="secondary" className="text-[10px]">
                        {entry.target_type}
                      </Badge>
                      <span className="ml-auto shrink-0 text-xs text-muted-foreground">
                        {timeAgo(entry.created_at)}
                      </span>
                    </div>
                    {entry.details && (
                      <p className="mt-0.5 truncate text-xs text-muted-foreground" title={entry.details}>
                        {entry.details}
                      </p>
                    )}
                    <p className="mt-0.5 text-[11px] text-muted-foreground/80">
                      {entry.actor_name ?? entry.actor_uid ?? '—'}
                    </p>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
