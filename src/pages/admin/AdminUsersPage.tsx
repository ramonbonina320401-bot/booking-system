import { useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { doc, updateDoc } from 'firebase/firestore'
import { toast } from 'sonner'
import {
  Ban,
  Loader2,
  Mail,
  Phone,
  RotateCcw,
  Search,
  ShieldCheck,
  ShieldX,
  UserRound,
  Users as UsersIcon,
} from 'lucide-react'

import { useI18n, tr } from '@/lib/i18n'
import { db } from '@/lib/firebase'
import { logAudit } from '@/lib/audit'
import { AdminHero } from '@/components/layout/AdminHero'
import { useUsers, type UserRow } from '@/hooks/useUsers'
import { useAuth } from '@/hooks/useAuth'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { cn } from '@/lib/utils'

type RoleFilter = 'all' | 'admin' | 'user'
type Role = 'admin' | 'user'

function initials(name: string | null): string {
  if (!name) return '?'
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('')
}

export function AdminUsersPage() {
  const { t } = useI18n()
  const queryClient = useQueryClient()
  const { user: me } = useAuth()
  const { data: users, isLoading, isError } = useUsers()
  const [query, setQuery] = useState('')
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('all')
  // Confirm-dialog targets
  const [roleTarget, setRoleTarget] = useState<UserRow | null>(null)
  const [activeTarget, setActiveTarget] = useState<UserRow | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['admin-users'] })

  const filtered = useMemo(() => {
    if (!users) return []
    const q = query.trim().toLowerCase()
    return users.filter((u) => {
      if (roleFilter !== 'all' && u.role !== roleFilter) return false
      if (!q) return true
      return (
        (u.full_name ?? '').toLowerCase().includes(q) ||
        (u.email ?? '').toLowerCase().includes(q) ||
        (u.phone ?? '').toLowerCase().includes(q)
      )
    })
  }, [users, query, roleFilter])

  const stats = useMemo(() => {
    if (!users) return { total: 0, admins: 0, regular: 0 }
    return {
      total: users.length,
      admins: users.filter((u) => u.role === 'admin').length,
      regular: users.filter((u) => u.role === 'user').length,
    }
  }, [users])

  const isSelf = (u: UserRow) => me?.id === u.id

  // ── Actions ──────────────────────────────────────────────────────────────
  const toggleRole = async (u: UserRow) => {
    const newRole: Role = u.role === 'admin' ? 'user' : 'admin'
    // Never demote the last administrator — the app would have no admin left.
    if (u.role === 'admin' && stats.admins <= 1) {
      toast.error(t('au.lastAdmin'))
      setRoleTarget(null)
      return
    }
    setBusyId(u.id)
    try {
      await updateDoc(doc(db, 'profiles', u.id), { role: newRole })
      await logAudit({
        action: 'role_changed',
        target_type: 'user',
        target_id: u.id,
        details: `${u.full_name ?? u.id} → ${newRole}`,
      })
      toast.success(t('au.roleChanged', { name: u.full_name ?? '' }))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : tr('au.actionFailed'))
    } finally {
      setBusyId(null)
      setRoleTarget(null)
      invalidate()
    }
  }

  const setActive = async (u: UserRow, active: boolean) => {
    setBusyId(u.id)
    try {
      await updateDoc(doc(db, 'profiles', u.id), { active })
      await logAudit({
        action: active ? 'user_reactivated' : 'user_deactivated',
        target_type: 'user',
        target_id: u.id,
        details: u.full_name ?? u.id,
      })
      toast.success(
        active
          ? t('au.userReactivated', { name: u.full_name ?? '' })
          : t('au.userDeactivated', { name: u.full_name ?? '' })
      )
    } catch (err) {
      toast.error(err instanceof Error ? err.message : tr('au.actionFailed'))
    } finally {
      setBusyId(null)
      setActiveTarget(null)
      invalidate()
    }
  }

  const pill = (label: string, value: number, active: boolean, onClick: () => void) => (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex items-baseline gap-1.5 rounded-xl border px-3.5 py-2 text-left transition-colors',
        active
          ? 'border-primary/40 bg-primary/5 text-foreground'
          : 'border-border bg-card text-muted-foreground hover:border-primary/30'
      )}
    >
      <span className="text-lg font-bold leading-none">{value}</span>
      <span className="text-xs font-medium">{label}</span>
    </button>
  )

  const formatJoined = (ts: string) => {
    if (!ts) return '—'
    const n = Number(ts)
    if (Number.isNaN(n) || n <= 0) return '—'
    const d = new Date(n)
    if (Number.isNaN(d.getTime())) return '—'
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
  }

  const renderPhone = (u: UserRow) =>
    u.phone ? (
      <span className="inline-flex items-center gap-1.5">
        <Phone className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
        <a href={`tel:${u.phone}`} className="hover:text-primary hover:underline">
          {u.phone}
        </a>
      </span>
    ) : (
      <span className="text-muted-foreground/70">—</span>
    )

  const renderEmail = (u: UserRow) =>
    u.email ? (
      <span className="inline-flex min-w-0 items-center gap-1.5">
        <Mail className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
        <a
          href={`mailto:${u.email}`}
          className="truncate hover:text-primary hover:underline"
          title={u.email}
        >
          {u.email}
        </a>
      </span>
    ) : (
      <span className="text-muted-foreground/70">—</span>
    )

  const renderRole = (u: UserRow) => (
    <div className="flex flex-wrap items-center gap-1.5">
      <Badge variant={u.role === 'admin' ? 'default' : 'secondary'}>{t(`role.${u.role}`)}</Badge>
      {!u.active && <Badge variant="secondary">{t('au.inactive')}</Badge>}
    </div>
  )

  const renderIdentity = (u: UserRow) => (
    <div className="flex items-center gap-3">
      <Avatar className={cn('h-9 w-9', !u.active && 'opacity-50 grayscale')}>
        {u.avatar_url ? (
          <AvatarImage src={u.avatar_url} alt={u.full_name ?? ''} />
        ) : (
          <AvatarFallback className="bg-primary/10 text-primary">{initials(u.full_name)}</AvatarFallback>
        )}
      </Avatar>
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold">
          {u.full_name ?? '—'}
          {isSelf(u) && <span className="ml-1.5 text-xs font-normal text-muted-foreground">({t('au.you')})</span>}
        </p>
        <p className="truncate text-xs text-muted-foreground">
          {t('au.bookingsCount', { count: u.bookingCount })}
        </p>
      </div>
    </div>
  )

  const renderActions = (u: UserRow) => {
    if (busyId === u.id) {
      return <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" aria-label={t('common.loading')} />
    }
    if (isSelf(u)) {
      // You can't demote or deactivate your own account from here.
      return <span className="text-xs text-muted-foreground">{t('au.you')}</span>
    }
    return (
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setRoleTarget(u)}
          disabled={u.role === 'admin' && stats.admins <= 1}
          title={u.role === 'admin' && stats.admins <= 1 ? t('au.lastAdmin') : undefined}
        >
          {u.role === 'admin' ? (
            <>
              <ShieldX className="h-3.5 w-3.5" />
              <span className="hidden xl:inline">{t('au.makeRegular')}</span>
            </>
          ) : (
            <>
              <ShieldCheck className="h-3.5 w-3.5" />
              <span className="hidden xl:inline">{t('au.makeAdmin')}</span>
            </>
          )}
        </Button>
        {u.role === 'user' &&
          (u.active ? (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setActiveTarget(u)}
              aria-label={t('au.deactivateAria', { name: u.full_name ?? '' })}
              title={t('au.deactivate')}
            >
              <Ban className="h-4 w-4 text-destructive" />
            </Button>
          ) : (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => void setActive(u, true)}
              aria-label={t('au.reactivateAria', { name: u.full_name ?? '' })}
              title={t('au.reactivate')}
            >
              <RotateCcw className="h-4 w-4" />
            </Button>
          ))}
      </div>
    )
  }

  if (isError) {
    return <p className="text-sm text-destructive">{t('au.failedLoad')}</p>
  }

  return (
    <div className="space-y-6">
      <AdminHero
        eyebrow={t('ab.administration')}
        title={t('au.header')}
        subtitle={t('au.subtitle')}
      />

      {/* Stat pills — clickable to filter by role */}
      <div className="flex flex-wrap gap-2">
        {pill(t('au.totalUsers'), stats.total, roleFilter === 'all', () => setRoleFilter('all'))}
        {pill(t('au.admins'), stats.admins, roleFilter === 'admin', () => setRoleFilter('admin'))}
        {pill(t('au.regular'), stats.regular, roleFilter === 'user', () => setRoleFilter('user'))}
      </div>

      {/* Search + role filter */}
      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder={t('au.searchPlaceholder')}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label={t('au.searchLabel')}
          />
        </div>
        <Select value={roleFilter} onValueChange={(v) => setRoleFilter(v as RoleFilter)}>
          <SelectTrigger className="w-full sm:w-44" aria-label={t('au.filterRole')}>
            <SelectValue placeholder={t('au.allRoles')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('au.allRoles')}</SelectItem>
            <SelectItem value="admin">{t('role.admin')}</SelectItem>
            <SelectItem value="user">{t('role.user')}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">{t('common.loading')}</p>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={UsersIcon}
          title={query || roleFilter !== 'all' ? t('au.noMatches') : t('au.noUsers')}
          description={query || roleFilter !== 'all' ? t('au.noMatchesDesc') : t('au.noUsersDesc')}
        />
      ) : (
        <>
          <p className="text-sm text-muted-foreground">
            {t('au.count', { count: filtered.length })}
          </p>

          {/* Desktop table */}
          <div className="hidden overflow-hidden rounded-2xl border bg-card shadow-sm md:block">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>{t('au.user')}</TableHead>
                  <TableHead>{t('au.role')}</TableHead>
                  <TableHead>{t('au.email')}</TableHead>
                  <TableHead>{t('au.phone')}</TableHead>
                  <TableHead className="text-right">{t('au.bookings')}</TableHead>
                  <TableHead>{t('au.joined')}</TableHead>
                  <TableHead className="text-right">{t('au.actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((u) => (
                  <TableRow key={u.id} className={cn(!u.active && 'opacity-70')}>
                    <TableCell>{renderIdentity(u)}</TableCell>
                    <TableCell>{renderRole(u)}</TableCell>
                    <TableCell className="max-w-56">{renderEmail(u)}</TableCell>
                    <TableCell>{renderPhone(u)}</TableCell>
                    <TableCell className="text-right font-semibold">{u.bookingCount}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatJoined(u.created_at)}
                    </TableCell>
                    <TableCell className="text-right">{renderActions(u)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Mobile cards */}
          <div className="space-y-3 md:hidden">
            {filtered.map((u) => (
              <div key={u.id} className={cn('rounded-2xl border bg-card p-4 shadow-sm', !u.active && 'opacity-80')}>
                <div className="flex items-start justify-between gap-3">
                  {renderIdentity(u)}
                  {renderRole(u)}
                </div>
                <div className="mt-2 flex flex-col gap-1.5 text-sm text-muted-foreground">
                  <span className="min-w-0">{renderEmail(u)}</span>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                    <span>{renderPhone(u)}</span>
                    <span className="inline-flex items-center gap-1.5">
                      <UserRound className="h-3.5 w-3.5" aria-hidden="true" />
                      {t('au.joined')}: {formatJoined(u.created_at)}
                    </span>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2 border-t pt-3">
                  {renderActions(u)}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Role change confirm */}
      <ConfirmDialog
        open={roleTarget !== null}
        onOpenChange={(open) => { if (!open) setRoleTarget(null) }}
        title={
          roleTarget?.role === 'admin'
            ? t('au.makeRegularTitle', { name: roleTarget?.full_name ?? '' })
            : t('au.makeAdminTitle', { name: roleTarget?.full_name ?? '' })
        }
        description={
          roleTarget?.role === 'admin'
            ? t('au.makeRegularDesc')
            : t('au.makeAdminDesc')
        }
        confirmLabel={
          roleTarget?.role === 'admin' ? t('au.makeRegular') : t('au.makeAdmin')
        }
        tone="default"
        loading={busyId === roleTarget?.id}
        onConfirm={() => { if (roleTarget) void toggleRole(roleTarget) }}
      />

      {/* Deactivate confirm */}
      <ConfirmDialog
        open={activeTarget !== null}
        onOpenChange={(open) => { if (!open) setActiveTarget(null) }}
        title={t('au.deactivateTitle', { name: activeTarget?.full_name ?? '' })}
        description={t('au.deactivateDesc')}
        confirmLabel={t('au.deactivate')}
        loading={busyId === activeTarget?.id}
        onConfirm={() => { if (activeTarget) void setActive(activeTarget, false) }}
      />
    </div>
  )
}
