import { useState } from 'react'
import { toast } from 'sonner'
import { Pencil, Plus, Trash2, Wrench } from 'lucide-react'

import { useCreateResource, useDeleteResource, useResources, useUpdateResource } from '@/hooks/useResources'
import { useI18n, tr } from '@/lib/i18n'
import type { Resource } from '@/types/booking.types'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { EmptyState } from '@/components/ui/empty-state'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'

/** Admin CRUD for bookable resources. */
export function ResourceManager() {
  const { data: resources = [], isLoading } = useResources({ includeInactive: true })
  const { t } = useI18n()
  const createResource = useCreateResource()
  const updateResource = useUpdateResource()
  const deleteResource = useDeleteResource()

  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Resource | null>(null)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [isActive, setIsActive] = useState(true)

  const activeCount = resources.filter((r) => r.is_active).length

  const openCreate = () => {
    setEditing(null)
    setName('')
    setDescription('')
    setIsActive(true)
    setOpen(true)
  }

  const openEdit = (r: Resource) => {
    setEditing(r)
    setName(r.name)
    setDescription(r.description ?? '')
    setIsActive(r.is_active)
    setOpen(true)
  }

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error(tr('ar.nameRequired'))
      return
    }
    try {
      if (editing) {
        await updateResource.mutateAsync({ id: editing.id, name, description: description || null, is_active: isActive })
        toast.success(tr('ar.updated'))
      } else {
        await createResource.mutateAsync({ name, description: description || null, is_active: isActive })
        toast.success(tr('ar.created'))
      }
      setOpen(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : tr('ar.saveFailed'))
    }
  }

  const [deleteTarget, setDeleteTarget] = useState<Resource | null>(null)

  const handleDelete = async (r: Resource) => {
    try {
      await deleteResource.mutateAsync({ id: r.id })
      toast.success(tr('ar.deactivated'))
      setDeleteTarget(null)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : tr('ar.deleteFailed'))
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {isLoading ? t('common.loading') : t('ar.activeCount', { count: activeCount })}
        </p>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" /> {t('ar.addResource')}
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-lg" />
          ))}
        </div>
      ) : resources.length === 0 ? (
        <EmptyState
          icon={Wrench}
          title={t('ar.noResources')}
          description={t('ar.noResourcesDesc')}
          action={
            <Button size="sm" onClick={openCreate}>
              <Plus className="h-4 w-4" /> {t('ar.addFirst')}
            </Button>
          }
        />
      ) : (
        <ul className="space-y-2">
          {resources.map((r) => (
            <li key={r.id} className="flex items-center justify-between gap-4 rounded-lg border p-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{r.name}</span>
                  <Badge variant={r.is_active ? 'success' : 'secondary'}>{r.is_active ? t('ar.active') : t('ar.inactive')}</Badge>
                </div>
                {r.description && <p className="truncate text-sm text-muted-foreground">{r.description}</p>}
              </div>
              <div className="flex shrink-0 gap-1">
                <Button variant="ghost" size="icon" onClick={() => openEdit(r)} aria-label={t('ar.editAria', { name: r.name })}>
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => setDeleteTarget(r)} aria-label={t('ar.deactivateAria', { name: r.name })}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? t('ar.editResource') : t('ar.addResource2')}</DialogTitle>
            <DialogDescription>
              {editing ? t('ar.editDesc') : t('ar.addDesc')}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="resource-name">{t('ar.name')}</Label>
              <Input id="resource-name" value={name} onChange={(e) => setName(e.target.value)} placeholder={t('ar.namePlaceholder')} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="resource-desc">{t('ar.descOptional')}</Label>
              <Textarea
                id="resource-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
              />
            </div>
            <div className="flex items-center gap-2">
              <Switch id="resource-active" checked={isActive} onCheckedChange={setIsActive} />
              <Label htmlFor="resource-active">{t('ar.activeLabel')}</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button onClick={() => void handleSave()}>{editing ? t('ar.saveChanges') : t('ar.create')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => { if (!open) setDeleteTarget(null) }}
        title={t('ar.deactivateTitle', { name: deleteTarget?.name ?? t('ar.name') })}
        description={t('ar.deactivateDesc')}
        confirmLabel={t('ar.deactivate')}
        loading={deleteResource.isPending}
        onConfirm={() => { if (deleteTarget) void handleDelete(deleteTarget) }}
      />
    </div>
  )
}
