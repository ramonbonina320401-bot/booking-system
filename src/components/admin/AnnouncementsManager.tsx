import { useState } from 'react'
import { toast } from 'sonner'
import { CalendarX2, Loader2, Megaphone, Plus, Trash2 } from 'lucide-react'

import {
  useAnnouncements,
  useAddAnnouncement,
  useDeleteAnnouncement,
  formatDateRange,
} from '@/hooks/useAnnouncements'
import { useI18n, tr } from '@/lib/i18n'
import type { AnnouncementKind } from '@/types/announcement.types'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { EmptyState } from '@/components/ui/empty-state'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'

/**
 * AnnouncementsManager — post notices that users see on the Home and Booking
 * pages, or schedule a closure (dates are blocked in the booking calendar).
 * Stored in Firestore `announcements/{id}`; admins write, users read.
 */
export function AnnouncementsManager() {
  const { t } = useI18n()
  const { data: announcements = [], isPending } = useAnnouncements()
  const addAnnouncement = useAddAnnouncement()
  const deleteAnnouncement = useDeleteAnnouncement()

  const [kind, setKind] = useState<AnnouncementKind>('notice')
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)

  const canSubmit =
    title.trim().length > 0 && (kind === 'notice' || (startDate && endDate && startDate <= endDate))

  const handleAdd = async () => {
    if (!canSubmit) return
    try {
      await addAnnouncement.mutateAsync({
        title,
        body,
        kind,
        start_date: kind === 'closure' ? startDate : null,
        end_date: kind === 'closure' ? endDate : null,
      })
      toast.success(t('an.added'))
      setTitle('')
      setBody('')
      setStartDate('')
      setEndDate('')
      setKind('notice')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : tr('an.addFailed'))
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    try {
      await deleteAnnouncement.mutateAsync(deleteTarget)
      toast.success(t('an.deleted'))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : tr('an.addFailed'))
    } finally {
      setDeleteTarget(null)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Megaphone className="h-4 w-4 text-primary" aria-hidden="true" />
          {t('an.title')}
        </CardTitle>
        <CardDescription>{t('an.desc')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Add form */}
        <div className="space-y-3 rounded-xl border border-border p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>{t('an.kind')}</Label>
              <Select value={kind} onValueChange={(v) => setKind(v as AnnouncementKind)}>
                <SelectTrigger aria-label={t('an.kind')}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="notice">{t('an.notice')}</SelectItem>
                  <SelectItem value="closure">{t('an.closure')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="an-title">{t('an.titleField')}</Label>
              <Input
                id="an-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={t('an.titlePlaceholder')}
                maxLength={60}
              />
            </div>
          </div>

          {kind === 'closure' && (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="an-start">{t('an.startDate')}</Label>
                <Input
                  id="an-start"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="an-end">{t('an.endDate')}</Label>
                <Input
                  id="an-end"
                  type="date"
                  value={endDate}
                  min={startDate || undefined}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="an-body">{t('an.body')}</Label>
            <Textarea
              id="an-body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder={t('an.bodyPlaceholder')}
              rows={2}
            />
          </div>

          <div className="flex justify-end">
            <Button onClick={() => void handleAdd()} disabled={!canSubmit || addAnnouncement.isPending}>
              {addAnnouncement.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              {t('an.add')}
            </Button>
          </div>
        </div>

        {/* List */}
        {isPending ? (
          <div className="space-y-2" aria-hidden="true">
            <Skeleton className="h-16 w-full rounded-xl" />
            <Skeleton className="h-16 w-full rounded-xl" />
          </div>
        ) : announcements.length === 0 ? (
          <EmptyState
            compact
            icon={Megaphone}
            title={t('an.empty')}
            description={t('an.emptyDesc')}
          />
        ) : (
          <ul className="space-y-2">
            {announcements.map((a) => (
              <li key={a.id} className="flex items-start justify-between gap-3 rounded-xl border p-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{a.title}</span>
                    {a.kind === 'closure' ? (
                      <Badge variant="destructive" className="gap-1">
                        <CalendarX2 className="h-3 w-3" aria-hidden="true" />
                        {formatDateRange(a.start_date, a.end_date)}
                      </Badge>
                    ) : (
                      <Badge variant="secondary">{t('an.noticeBadge')}</Badge>
                    )}
                  </div>
                  {a.body && <p className="mt-0.5 truncate text-sm text-muted-foreground">{a.body}</p>}
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setDeleteTarget(a.id)}
                  aria-label={t('an.deleteAria')}
                  disabled={deleteAnnouncement.isPending}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => { if (!open) setDeleteTarget(null) }}
        title={t('an.deleteTitle')}
        description={t('an.deleteDesc')}
        confirmLabel={t('an.delete')}
        loading={deleteAnnouncement.isPending}
        onConfirm={() => void handleDelete()}
      />
    </Card>
  )
}
