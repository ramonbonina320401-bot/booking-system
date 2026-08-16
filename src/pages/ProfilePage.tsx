import { useEffect, useMemo, useRef, useState } from 'react'
import { format } from 'date-fns'
import { toast } from 'sonner'
import {
  AlertTriangle,
  AtSign,
  BadgeCheck,
  Bell,
  BellOff,
  BellRing,
  CalendarDays,
  Camera,
  Check,
  Loader2,
  Lock,
  Mail,
  MailCheck,
  MessageCircle,
  Phone,
  Save,
  ShieldCheck,
  Smartphone,
  Trash2,
  UserRound,
} from 'lucide-react'

import { useAuth } from '@/hooks/useAuth'
import { useI18n, tr } from '@/lib/i18n'
import { PageHero } from '@/components/layout/PageHero'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { disablePush, enablePush, getPushPermission } from '@/lib/fcm'
import { uploadAvatar } from '@/lib/storage'

function getInitials(name?: string | null, email?: string | null): string {
  const source = (name?.trim() || email?.trim() || '?').split(/\s+/)
  const first = source[0]?.[0] ?? '?'
  const second = source[1]?.[0] ?? ''
  return (first + second).toUpperCase()
}

function memberSince(createdAt: string): string {
  if (!createdAt) return '—'
  const n = Number(createdAt)
  const d = Number.isFinite(n) && n > 0 ? new Date(n) : new Date(createdAt)
  if (Number.isNaN(d.getTime())) return '—'
  return format(d, 'MMMM d, yyyy')
}

export function ProfilePage() {
  const {
    user,
    profile,
    isAdmin,
    updateProfileName,
    updateProfilePhone,
    updateProfileAvatar,
    sendPhoneUpdateCode,
    confirmPhoneUpdate,
    sendVerificationEmail,
    deleteAccount,
  } = useAuth()
  const { t } = useI18n()

  // ── Name editing ──────────────────────────────────────────────────────────
  const [fullName, setFullName] = useState('')
  const [savingName, setSavingName] = useState(false)
  const nameTouched = useRef(false)

  useEffect(() => {
    if (!nameTouched.current && profile?.full_name != null) {
      setFullName(profile.full_name)
    }
  }, [profile?.full_name])

  // ── Contact phone (profile doc — shown to admins in bookings) ─────────────
  const [contactPhone, setContactPhone] = useState('')
  const [savingPhone, setSavingPhone] = useState(false)
  const phoneTouched = useRef(false)

  useEffect(() => {
    if (!phoneTouched.current && profile?.phone != null) {
      setContactPhone(profile.phone)
    }
  }, [profile?.phone])

  // ── Avatar upload ─────────────────────────────────────────────────────────
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // ── Push notifications (FCM) ──────────────────────────────────────────────
  // ── Email verification ────────────────────────────────────────────────────
  const [verifyingBusy, setVerifyingBusy] = useState(false)
  const needsVerification = Boolean(user?.email && !user?.emailVerified)

  const handleVerifyEmail = async () => {
    setVerifyingBusy(true)
    try {
      const { error } = await sendVerificationEmail()
      if (error) throw error
      toast.success(tr('profile.verifySent'))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : tr('profile.verifyFailed'))
    } finally {
      setVerifyingBusy(false)
    }
  }

  // ── Account deletion (danger zone) ───────────────────────────────────────
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const handleDeleteAccount = async () => {
    setDeleting(true)
    try {
      const { error } = await deleteAccount()
      if (error) {
        if (error.message === 'recent-login') {
          toast.error(tr('profile.deleteRecentLogin'))
        } else {
          toast.error(error.message)
        }
        setDeleting(false)
        setDeleteOpen(false)
        return
      }
      toast.success(tr('profile.deleted'))
      // Router redirects to /login once the auth state clears.
    } catch (err) {
      toast.error(err instanceof Error ? err.message : tr('profile.deleteFailed'))
      setDeleting(false)
      setDeleteOpen(false)
    }
  }

  const [pushBusy, setPushBusy] = useState(false)
  const [pushPermission, setPushPermission] = useState<NotificationPermission | 'unsupported'>(() =>
    getPushPermission()
  )
  const pushEnabled = Boolean(profile?.fcm_token)

  const handleEnablePush = async () => {
    if (!user) return
    setPushBusy(true)
    const result = await enablePush(user.id)
    setPushBusy(false)
    setPushPermission(getPushPermission())
    if (result.ok) {
      toast.success(tr('profile.pushEnabled'))
    } else {
      toast.error(result.error ?? tr('profile.pushEnableFailed'))
    }
  }

  const handleDisablePush = async () => {
    if (!user) return
    setPushBusy(true)
    const result = await disablePush(user.id)
    setPushBusy(false)
    if (result.ok) {
      toast.success(tr('profile.pushDisabled'))
    } else {
      toast.error(result.error ?? tr('profile.pushDisableFailed'))
    }
  }

  // ── Sign-in phone editing (OTP flow) ──────────────────────────────────────
  const [phoneOpen, setPhoneOpen] = useState(false)
  const [newPhone, setNewPhone] = useState('')
  const [verificationId, setVerificationId] = useState<string | null>(null)
  const [otpCode, setOtpCode] = useState('')
  const [phoneBusy, setPhoneBusy] = useState(false)

  const signInPhone = user?.phone ?? null
  const displayName = profile?.full_name || user?.email || t('role.user')
  const initials = useMemo(() => getInitials(profile?.full_name, user?.email), [profile?.full_name, user?.email])

  if (!user) return null

  const handleSaveName = async () => {
    if (!fullName.trim()) {
      toast.error(tr('profile.nameEmpty'))
      return
    }
    setSavingName(true)
    try {
      const { error } = await updateProfileName(fullName)
      if (error) throw error
      toast.success(tr('profile.nameUpdated'))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : tr('profile.updateFailed', { field: t('profile.fullName') }))
    } finally {
      setSavingName(false)
    }
  }

  /** Save the contact phone (shown in the admin bookings table). */
  const handleSavePhone = async () => {
    const digits = contactPhone.replace(/[^\d+]/g, '')
    if (digits && digits.length < 10) {
      toast.error(tr('login.phoneInvalid'))
      return
    }
    setSavingPhone(true)
    try {
      const { error } = await updateProfilePhone(contactPhone)
      if (error) throw error
      toast.success(contactPhone.trim() ? tr('profile.contactSaved') : tr('profile.contactRemoved'))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : tr('profile.updateFailed', { field: t('profile.contactPhone') }))
    } finally {
      setSavingPhone(false)
    }
  }

  const handleAvatarChange = async (file: File | undefined) => {
    if (!file) return
    setUploadingAvatar(true)
    try {
      const dataUrl = await uploadAvatar(file)
      const { error } = await updateProfileAvatar(dataUrl)
      if (error) throw error
      toast.success(tr('profile.photoUpdated'))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : tr('logo.uploadFailed'))
    } finally {
      setUploadingAvatar(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleRemoveAvatar = async () => {
    setUploadingAvatar(true)
    try {
      const { error } = await updateProfileAvatar(null)
      if (error) throw error
      toast.success(tr('profile.photoRemoved'))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : tr('profile.updateFailed', { field: t('profile.removePhoto') }))
    } finally {
      setUploadingAvatar(false)
    }
  }

  /** Step 1 — send OTP to the new number. */
  const handleSendCode = async () => {
    const digits = newPhone.replace(/[^\d+]/g, '')
    if (digits.length < 10) {
      toast.error(tr('login.phoneInvalid'))
      return
    }
    setPhoneBusy(true)
    try {
      // Clear the recaptcha container so retries don't hit "already rendered".
      const container = document.getElementById('profile-phone-recaptcha')
      if (container) container.innerHTML = ''
      const { verificationId: vid, error } = await sendPhoneUpdateCode(digits, 'profile-phone-recaptcha')
      if (error || !vid) throw error ?? new Error(tr('login.couldNotSend'))
      setVerificationId(vid)
      toast.success(tr('profile.codeSent'))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : tr('login.couldNotSend'))
    } finally {
      setPhoneBusy(false)
    }
  }

  /** Step 2 — apply the verified number to this account. */
  const handleConfirm = async () => {
    if (!verificationId) return
    setPhoneBusy(true)
    try {
      const { error } = await confirmPhoneUpdate(verificationId, otpCode.trim())
      if (error) throw error
      toast.success(tr('profile.phoneUpdated'))
      setPhoneOpen(false)
      setVerificationId(null)
      setOtpCode('')
      setNewPhone('')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : tr('login.invalidCode'))
    } finally {
      setPhoneBusy(false)
    }
  }

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-10">
      {/* Page header — same hero treatment as the Home page */}
      <PageHero
        eyebrow={t('profile.eyebrow')}
        title={t('profile.title')}
        subtitle={t('profile.subtitle')}
      />

      {/* Identity header card with avatar upload */}
      <Card>
        <CardContent className="flex flex-col items-center gap-5 py-8 sm:flex-row sm:items-center">
          {/* Avatar with upload affordance */}
          <div className="relative shrink-0">
            {profile?.avatar_url ? (
              <img
                src={profile.avatar_url}
                alt={`${displayName}'s profile photo`}
                className="h-24 w-24 rounded-full border-4 border-background object-cover shadow-lg"
              />
            ) : (
              <div className="flex h-24 w-24 items-center justify-center rounded-full bg-primary text-3xl font-bold text-primary-foreground shadow-lg">
                {initials}
              </div>
            )}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingAvatar}
              aria-label={t('profile.changePhoto')}
              title={t('profile.changePhoto')}
              className="absolute -bottom-1 -right-1 flex h-9 w-9 items-center justify-center rounded-full border-2 border-background bg-primary text-primary-foreground shadow-md transition-transform hover:scale-105 active:scale-95 disabled:opacity-60"
            >
              {uploadingAvatar ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              aria-hidden="true"
              tabIndex={-1}
              onChange={(e) => void handleAvatarChange(e.target.files?.[0])}
            />
          </div>

          <div className="flex-1 text-center sm:text-left">
            <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
              <h2 className="text-xl font-bold">{displayName}</h2>
              <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
                {isAdmin ? <ShieldCheck className="h-3 w-3" /> : <UserRound className="h-3 w-3" />}
                {isAdmin ? t('role.admin') : t('role.user')}
              </span>
            </div>
            <div className="mt-2 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-sm text-muted-foreground sm:justify-start">
              <span className="flex items-center gap-1.5">
                <Mail className="h-3.5 w-3.5" />
                {user.email || t('profile.noEmail')}
              </span>
              {signInPhone && (
                <span className="flex items-center gap-1.5">
                  <Smartphone className="h-3.5 w-3.5" />
                  {signInPhone}
                </span>
              )}
              <span className="flex items-center gap-1.5">
                <CalendarDays className="h-3.5 w-3.5" />
                {t('profile.joined', { date: memberSince(profile?.created_at ?? '') })}
              </span>
            </div>
            {profile?.avatar_url && (
              <button
                type="button"
                onClick={() => void handleRemoveAvatar()}
                disabled={uploadingAvatar}
                className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-muted-foreground transition-colors hover:text-destructive disabled:opacity-50"
              >
                <Trash2 className="h-3 w-3" />
                {t('profile.removePhoto')}
              </button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Full name */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BadgeCheck className="h-5 w-5 text-primary" />
            {t('profile.details')}
          </CardTitle>
          <CardDescription>{t('profile.detailsDesc')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="profile-name">{t('profile.fullName')}</Label>
            <Input
              id="profile-name"
              value={fullName}
              onChange={(e) => {
                nameTouched.current = true
                setFullName(e.target.value)
              }}
              autoComplete="name"
              maxLength={60}
            />
          </div>
          <div className="flex justify-end">
            <Button onClick={() => void handleSaveName()} disabled={savingName || fullName.trim() === (profile?.full_name ?? '')}>
              {savingName ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {t('profile.saveName')}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Contact details — email + contact phone (shown in admin bookings) */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AtSign className="h-5 w-5 text-primary" />
            {t('profile.contact')}
          </CardTitle>
          <CardDescription>{t('profile.contactDesc')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Email — read-only (auth-owned) */}
          <div className="flex items-center justify-between gap-4 rounded-xl border border-border bg-muted/40 px-4 py-3">
            <div className="flex min-w-0 items-center gap-2 text-sm font-medium">
              <Mail className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="truncate">{user.email || t('profile.noEmail')}</span>
              {user.email &&
                (user.emailVerified ? (
                  <MailCheck className="h-4 w-4 shrink-0 text-emerald-500" aria-label={t('profile.verified')} />
                ) : (
                  <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-semibold text-amber-600 dark:text-amber-400">
                    <AlertTriangle className="h-3 w-3" />
                    {t('profile.unverified')}
                  </span>
                ))}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {needsVerification && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => void handleVerifyEmail()}
                  disabled={verifyingBusy}
                >
                  {verifyingBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
                  {t('profile.verifyEmail')}
                </Button>
              )}
              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                <Lock className="h-3 w-3" />
                {t('profile.usedForSignIn')}
              </span>
            </div>
          </div>
          {needsVerification && (
            <p className="text-xs text-amber-600 dark:text-amber-400">{t('profile.verifyHint')}</p>
          )}

          {/* Contact phone — editable without OTP */}
          <div className="space-y-2">
            <Label htmlFor="profile-contact-phone">
              {t('profile.contactPhone')}
              <span className="ml-1 text-xs font-normal text-muted-foreground">{t('profile.shownToAdmins')}</span>
            </Label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                id="profile-contact-phone"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                placeholder={t('login.phonePlaceholder')}
                value={contactPhone}
                onChange={(e) => {
                  phoneTouched.current = true
                  setContactPhone(e.target.value)
                }}
              />
              <Button
                onClick={() => void handleSavePhone()}
                disabled={savingPhone || contactPhone.trim() === (profile?.phone ?? '')}
                className="shrink-0 sm:w-auto w-full"
              >
                {savingPhone ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                {t('common.save')}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">{t('profile.contactPhoneNote')}</p>
          </div>

        </CardContent>
      </Card>

      {/* Sign-in phone */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Phone className="h-5 w-5 text-primary" />
            {t('profile.signInPhone')}
          </CardTitle>
          <CardDescription>
            {signInPhone
              ? t('profile.signInPhoneDesc', { phone: signInPhone })
              : t('profile.signInPhoneDesc2')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {signInPhone ? (
            <div className="flex items-center justify-between rounded-xl border border-border bg-muted/40 px-4 py-3">
              <span className="flex items-center gap-2 text-sm font-medium">
                <Smartphone className="h-4 w-4 text-muted-foreground" />
                {signInPhone}
              </span>
              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                <Lock className="h-3 w-3" />
                {t('profile.usedForSignIn')}
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-2 rounded-xl border border-dashed border-border px-4 py-3 text-sm text-muted-foreground">
              <MessageCircle className="h-4 w-4" />
              {t('profile.noPhoneYet')}
            </div>
          )}

          {!phoneOpen ? (
            <Button variant="outline" onClick={() => setPhoneOpen(true)}>
              <Phone className="h-4 w-4" />
              {signInPhone ? t('profile.changePhone') : t('profile.addPhone')}
            </Button>
          ) : (
            <div className="space-y-3 rounded-lg border border-border p-4">
              {!verificationId ? (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="profile-phone">{t('profile.newPhone')}</Label>
                    <Input
                      id="profile-phone"
                      type="tel"
                      inputMode="tel"
                      autoComplete="tel"
                      placeholder={t('login.phonePlaceholder')}
                      value={newPhone}
                      onChange={(e) => setNewPhone(e.target.value)}
                    />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" onClick={() => void handleSendCode()} disabled={phoneBusy}>
                      {phoneBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageCircle className="h-4 w-4" />}
                      {t('login.sendCode')}
                    </Button>
                    <Button type="button" variant="ghost" onClick={() => setPhoneOpen(false)} disabled={phoneBusy}>
                      {t('common.cancel')}
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="profile-otp">{t('login.verificationCode')}</Label>
                    <Input
                      id="profile-otp"
                      type="text"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      placeholder={t('login.codePlaceholder')}
                      value={otpCode}
                      onChange={(e) => setOtpCode(e.target.value)}
                    />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      onClick={() => void handleConfirm()}
                      disabled={phoneBusy || otpCode.trim().length < 6}
                    >
                      {phoneBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                      {t('profile.confirmSave')}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => {
                        setVerificationId(null)
                        setOtpCode('')
                      }}
                      disabled={phoneBusy}
                    >
                      {t('login.differentNumber')}
                    </Button>
                  </div>
                </>
              )}
              {/* Invisible reCAPTCHA target for Firebase phone verification */}
              <div id="profile-phone-recaptcha" />
            </div>
          )}

          <p className="text-xs text-muted-foreground">{t('profile.phoneNote')}</p>
        </CardContent>
      </Card>

      {/* Danger zone — permanent account deletion */}
      <Card className="mt-6 border-destructive/40">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            {t('profile.dangerZone')}
          </CardTitle>
          <CardDescription>{t('profile.dangerDesc')}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            variant="destructive"
            onClick={() => setDeleteOpen(true)}
            disabled={deleting}
            className="w-full sm:w-auto"
          >
            {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            {t('profile.deleteAccount')}
          </Button>
        </CardContent>
      </Card>

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={(open) => { if (!open) setDeleteOpen(false) }}
        title={t('profile.deleteTitle')}
        description={t('profile.deleteDesc')}
        confirmLabel={t('profile.deleteConfirm')}
        tone="destructive"
        loading={deleting}
        onConfirm={() => void handleDeleteAccount()}
      />

      {/* Push notifications (FCM) */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-primary" />
            {t('profile.push')}
          </CardTitle>
          <CardDescription>{t('profile.pushDesc')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {pushPermission === 'unsupported' ? (
            <div className="flex items-center gap-2 rounded-xl border border-dashed border-border px-4 py-3 text-sm text-muted-foreground">
              <BellOff className="h-4 w-4" />
              {t('profile.pushUnsupported')}
            </div>
          ) : pushEnabled ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-4 rounded-xl border border-border bg-muted/40 px-4 py-3">
                <span className="flex items-center gap-2 text-sm font-medium">
                  <BellRing className="h-4 w-4 text-primary" />
                  {t('profile.onDevice')}
                </span>
                <Button variant="outline" size="sm" onClick={() => void handleDisablePush()} disabled={pushBusy}>
                  {pushBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <BellOff className="h-4 w-4" />}
                  {t('profile.turnOff')}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                {pushPermission === 'denied' ? t('profile.pushBlocked') : t('profile.noSpam')}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <Button onClick={() => void handleEnablePush()} disabled={pushBusy}>
                {pushBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bell className="h-4 w-4" />}
                {t('profile.enablePush')}
              </Button>
              <p className="text-xs text-muted-foreground">
                {pushPermission === 'denied' ? t('profile.pushBlockedRetry') : t('profile.pushConfirmDesc')}
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </main>
  )
}
