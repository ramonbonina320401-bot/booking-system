import { useMemo, useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router'
import { CalendarDays, Chrome, Eye, EyeOff, Facebook, Loader2, LogIn, Mail, MessageCircle, Phone, ShieldCheck, Sparkles, UserPlus, UserRound } from 'lucide-react'
import type { ConfirmationResult } from 'firebase/auth'
import { toast } from 'sonner'

import { useAuth } from '@/hooks/useAuth'
import { useSettings } from '@/contexts/SettingsContext'
import { useI18n, tr, type Lang } from '@/lib/i18n'
import { Brand } from '@/components/layout/Brand'
import { LanguageToggle } from '@/components/layout/LanguageToggle'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

// Demo accounts created by scripts/seed-firestore.mjs --demo-users.
// These quick-login buttons only render in development builds.
const DEMO_ACCOUNTS = [
  { label: 'Admin', email: 'admin@booking.test', password: 'Admin123!', icon: ShieldCheck },
  { label: 'User', email: 'user@booking.test', password: 'User123!', icon: UserRound },
]

/** Lightweight strength check for the signup password. Scores 5 criteria
 *  (length, upper, lower, digit, special) and maps them to 3 levels so the
 *  meter is honest without being pedantic. */
function passwordStrength(pw: string): 'weak' | 'medium' | 'strong' | null {
  if (!pw) return null
  let score = 0
  if (pw.length >= 8) score++
  if (/[A-Z]/.test(pw)) score++
  if (/[a-z]/.test(pw)) score++
  if (/[0-9]/.test(pw)) score++
  if (/[^A-Za-z0-9]/.test(pw)) score++
  if (score <= 2) return 'weak'
  if (score === 3) return 'medium'
  return 'strong'
}

/** Time-of-day greeting — the small personal touch that replaces "welcome back".
 *  Signup mode swaps in a mode-aware headline instead. */
export function greeting(): string {
  const h = new Date().getHours()
  const key = h < 12 ? 'login.goodMorning' : h < 18 ? 'login.goodAfternoon' : 'login.goodEvening'
  return tr(key)
}

export function todayLabel(lang: Lang = 'en'): string {
  return new Date().toLocaleDateString(lang === 'fil' ? 'fil-PH' : 'en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  })
}

export function LoginPage() {
  const { signIn, signUp, signInWithGoogle, signInWithFacebook, sendPhoneCode, confirmPhoneCode, sendPasswordReset } =
    useAuth()
  const { branding } = useSettings()
  const { lang, t } = useI18n()
  const navigate = useNavigate()
  const location = useLocation()

  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [fullName, setFullName] = useState('')
  const [submitting, setSubmitting] = useState(false)
  // Third-party / phone login state
  const [socialBusy, setSocialBusy] = useState<'google' | 'facebook' | null>(null)
  const [phoneOpen, setPhoneOpen] = useState(false)
  const [phoneNumber, setPhoneNumber] = useState('')
  const [otpCode, setOtpCode] = useState('')
  const [confirmation, setConfirmation] = useState<ConfirmationResult | null>(null)
  const [phoneBusy, setPhoneBusy] = useState(false)
  // Forgot-password inline panel
  const [forgotOpen, setForgotOpen] = useState(false)
  const [resetEmail, setResetEmail] = useState('')
  const [resetBusy, setResetBusy] = useState(false)

  const from = (location.state as { from?: string } | null)?.from ?? '/'
  const anyBusy = submitting || socialBusy !== null || phoneBusy

  const strength = useMemo(() => passwordStrength(password), [password])

  const tagline = useMemo(() => {
    const name = branding.appName
    if (mode === 'signup') return t('login.signupTagline', { app: name })
    return t('login.tagline', { app: name })
  }, [t, branding.appName, mode])

  /** Sign in directly with a demo account (one click — no typing). */
  const quickLogin = async (demoEmail: string, demoPassword: string) => {
    if (mode !== 'login') setMode('login')
    setEmail(demoEmail)
    setPassword(demoPassword)
    setSubmitting(true)
    try {
      const { error } = await signIn(demoEmail, demoPassword)
      if (error) throw error
      toast.success(tr('login.welcomeBack'))
      navigate(from, { replace: true })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : tr('login.loginFailed'))
    } finally {
      setSubmitting(false)
    }
  }

  /** Google / Facebook — popup sign-in with auto profile creation. */
  const handleSocial = async (provider: 'google' | 'facebook') => {
    setSocialBusy(provider)
    try {
      const { error } = provider === 'google' ? await signInWithGoogle() : await signInWithFacebook()
      if (error) throw error
      toast.success(tr('login.welcomeBack'))
      navigate(from, { replace: true })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : tr('login.providerFailed', { provider }))
    } finally {
      setSocialBusy(null)
    }
  }

  /** Phone OTP — step 1: send the verification code. */
  const handleSendCode = async () => {
    const digits = phoneNumber.replace(/[^\d+]/g, '')
    if (digits.length < 10) {
      toast.error(tr('login.phoneInvalid'))
      return
    }
    setPhoneBusy(true)
    try {
      // Clear the recaptcha container so retries don't hit "already rendered".
      const container = document.getElementById('phone-recaptcha')
      if (container) container.innerHTML = ''
      const { confirmation: conf, error } = await sendPhoneCode(digits, 'phone-recaptcha')
      if (error || !conf) throw error ?? new Error(tr('login.couldNotSend'))
      setConfirmation(conf)
      toast.success(tr('login.codeSent'))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : tr('login.couldNotSend'))
    } finally {
      setPhoneBusy(false)
    }
  }

  /** Phone OTP — step 2: verify the code. */
  const handleVerifyCode = async () => {
    if (!confirmation) return
    setPhoneBusy(true)
    try {
      const { error } = await confirmPhoneCode(confirmation, otpCode.trim())
      if (error) throw error
      toast.success(tr('login.welcomeBack'))
      navigate(from, { replace: true })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : tr('login.invalidCode'))
    } finally {
      setPhoneBusy(false)
    }
  }

  /** Forgot password — Firebase sends a reset link to the email. */
  const handleResetPassword = async (e: FormEvent) => {
    e.preventDefault()
    if (!resetEmail.trim()) {
      toast.error(tr('login.required'))
      return
    }
    setResetBusy(true)
    try {
      const { error } = await sendPasswordReset(resetEmail.trim())
      if (error) throw error
      toast.success(tr('login.resetSent'))
      setForgotOpen(false)
      setResetEmail('')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : tr('login.resetFailed'))
    } finally {
      setResetBusy(false)
    }
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!email || !password) {
      toast.error(tr('login.required'))
      return
    }
    setSubmitting(true)
    try {
      if (mode === 'login') {
        const { error } = await signIn(email, password)
        if (error) throw error
        toast.success(tr('login.welcomeBack'))
        navigate(from, { replace: true })
      } else {
        if (!fullName.trim()) {
          toast.error(tr('login.nameRequired'))
          setSubmitting(false)
          return
        }
        if (password.length < 8) {
          toast.error(tr('login.passwordTooShort'))
          setSubmitting(false)
          return
        }
        const { error } = await signUp(email, password, fullName)
        if (error) throw error
        toast.success(tr('login.accountCreated'))
        setMode('login')
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : tr('login.authFailed'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main
      className="flex min-h-dvh items-center justify-center px-4 py-12"
      style={{ backgroundColor: 'var(--app-background)' }}
    >
      <div className="w-full max-w-sm">
        {/* Language switch — available before login */}
        <div className="mb-4 flex justify-end">
          <LanguageToggle variant="pill" />
        </div>

        {/* Branded welcome hero — replaces the plain "welcome back" line */}
        <div
          className="relative mb-6 overflow-hidden rounded-3xl p-6 text-white shadow-lg"
          style={{
            background: `linear-gradient(135deg, var(--app-primary, #2563eb) 0%, var(--app-accent, #f59e0b) 130%)`,
          }}
        >
          {/* Decorative floating shapes */}
          <span
            className="pointer-events-none absolute -right-8 -top-10 h-32 w-32 rounded-full opacity-20"
            style={{ backgroundColor: 'white' }}
            aria-hidden="true"
          />
          <span
            className="pointer-events-none absolute -bottom-12 right-12 h-24 w-24 rounded-full opacity-10"
            style={{ backgroundColor: 'white' }}
            aria-hidden="true"
          />
          <span
            className="pointer-events-none absolute -left-6 -bottom-8 h-20 w-20 rounded-2xl opacity-15"
            style={{ backgroundColor: 'white', transform: 'rotate(20deg)' }}
            aria-hidden="true"
          />

          <div className="relative">
            <div className="hero-reveal flex items-center justify-between" style={{ animationDelay: '60ms' }}>
              <span className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-widest text-white/80">
                <CalendarDays className="h-3.5 w-3.5" />
                {todayLabel(lang)}
              </span>
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/20 backdrop-blur-sm">
                <Sparkles className="h-4 w-4 text-white" />
              </span>
            </div>

            <div className="hero-reveal mt-4 flex items-center gap-3" style={{ animationDelay: '160ms' }}>
              <span className="inline-flex rounded-xl bg-white/95 px-3 py-1.5 shadow-sm">
                <Brand className="max-h-8" />
              </span>
            </div>

            <p className="mt-5 text-2xl font-bold tracking-tight">
              <span className="hero-type" style={{ animationDelay: '280ms' }}>
                {mode === 'signup' ? t('login.createHeadline') : greeting()}
                <span className="hero-caret" aria-hidden="true" />
              </span>
              <span className="hero-reveal block text-sm font-medium text-white/85" style={{ animationDelay: '560ms' }}>
                {tagline}
              </span>
            </p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{mode === 'login' ? t('login.signIn') : t('login.createAccount')}</CardTitle>
            {mode === 'login' ? (
              <p className="text-sm text-muted-foreground">{t('login.enterCredentials')}</p>
            ) : (
              <p className="text-sm text-muted-foreground">{t('login.bookSlotsOwn')}</p>
            )}
          </CardHeader>
          <CardContent className="space-y-5">
            <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
              {mode === 'signup' && (
                <div className="space-y-2">
                  <Label htmlFor="full-name">{t('login.fullName')}</Label>
                  <Input id="full-name" value={fullName} onChange={(e) => setFullName(e.target.value)} autoComplete="name" />
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="email">{t('login.email')}</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  required
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">{t('login.password')}</Label>
                  {mode === 'login' && (
                    <button
                      type="button"
                      className="text-xs font-medium text-primary underline-offset-4 hover:underline"
                      onClick={() => setForgotOpen((v) => !v)}
                    >
                      {t('login.forgotPassword')}
                    </button>
                  )}
                </div>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                    required
                    minLength={mode === 'signup' ? 8 : 6}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? t('login.hidePassword') : t('login.showPassword')}
                    aria-pressed={showPassword}
                    className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {mode === 'signup' && (
                  <>
                    {/* Strength meter — 3 segments, only while typing */}
                    {strength && (
                      <div className="mt-2 space-y-1.5">
                        <div className="flex gap-1" aria-hidden="true">
                          {[0, 1, 2].map((i) => (
                            <span
                              key={i}
                              className={`h-1 flex-1 rounded-full transition-colors ${
                                i < (strength === 'weak' ? 1 : strength === 'medium' ? 2 : 3)
                                  ? strength === 'weak'
                                    ? 'bg-red-500'
                                    : strength === 'medium'
                                      ? 'bg-amber-500'
                                      : 'bg-emerald-500'
                                  : 'bg-border'
                              }`}
                            />
                          ))}
                        </div>
                        <p
                          role="status"
                          className={`text-xs font-medium ${
                            strength === 'weak'
                              ? 'text-red-500'
                              : strength === 'medium'
                                ? 'text-amber-600'
                                : 'text-emerald-600'
                          }`}
                        >
                          {t(
                            strength === 'weak'
                              ? 'login.strengthWeak'
                              : strength === 'medium'
                                ? 'login.strengthMedium'
                                : 'login.strengthStrong'
                          )}
                        </p>
                      </div>
                    )}
                    <p className="text-xs text-muted-foreground">{t('login.passwordHint')}</p>
                  </>
                )}
              </div>

              {forgotOpen && mode === 'login' && (
                <form onSubmit={(e) => void handleResetPassword(e)} className="space-y-2 rounded-xl border border-border bg-muted/40 p-3">
                  <Label htmlFor="reset-email">{t('login.resetEmail')}</Label>
                  <Input
                    id="reset-email"
                    type="email"
                    placeholder={t('login.email')}
                    value={resetEmail}
                    onChange={(e) => setResetEmail(e.target.value)}
                    autoComplete="email"
                    required
                  />
                  <div className="flex gap-2">
                    <Button type="submit" size="sm" disabled={resetBusy}>
                      {resetBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
                      {t('login.sendResetLink')}
                    </Button>
                    <Button type="button" variant="ghost" size="sm" onClick={() => setForgotOpen(false)}>
                      {t('common.cancel')}
                    </Button>
                  </div>
                </form>
              )}
              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : mode === 'login' ? (
                  <LogIn className="h-4 w-4" />
                ) : (
                  <UserPlus className="h-4 w-4" />
                )}
                {mode === 'login' ? t('login.signIn') : t('login.createAccount')}
              </Button>
            </form>

            {/* Divider + third-party options (login AND signup — works for both) */}
            <div className="space-y-3">
              <div className="flex items-center gap-3" aria-hidden="true">
                <span className="h-px flex-1 bg-border" />
                <span className="text-xs uppercase tracking-wider text-muted-foreground">
                  {mode === 'login' ? t('login.orContinueWith') : t('login.orSignUpWith')}
                </span>
                <span className="h-px flex-1 bg-border" />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => void handleSocial('google')}
                  disabled={anyBusy}
                >
                  {socialBusy === 'google' ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Chrome className="h-4 w-4" />
                  )}
                  {t('login.google')}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => void handleSocial('facebook')}
                  disabled={anyBusy}
                >
                  {socialBusy === 'facebook' ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Facebook className="h-4 w-4 text-[#1877F2]" />
                  )}
                  {t('login.facebook')}
                </Button>
              </div>

              {/* Phone number (Viber-style) login */}
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => setPhoneOpen((v) => !v)}
                disabled={anyBusy}
              >
                <MessageCircle className="h-4 w-4" />
                {phoneOpen ? t('login.closePhoneLogin') : t('login.phoneLogin')}
              </Button>

              {phoneOpen && (
                <div className="space-y-3 rounded-lg border border-border p-4">
                  {!confirmation ? (
                    <>
                      <div className="space-y-2">
                        <Label htmlFor="phone">{t('login.phoneNumber')}</Label>
                        <Input
                          id="phone"
                          type="tel"
                          inputMode="tel"
                          autoComplete="tel"
                          placeholder={t('login.phonePlaceholder')}
                          value={phoneNumber}
                          onChange={(e) => setPhoneNumber(e.target.value)}
                        />
                      </div>
                      <Button
                        type="button"
                        className="w-full"
                        onClick={() => void handleSendCode()}
                        disabled={phoneBusy}
                      >
                        {phoneBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Phone className="h-4 w-4" />}
                        {t('login.sendCode')}
                      </Button>
                    </>
                  ) : (
                    <>
                      <div className="space-y-2">
                        <Label htmlFor="otp">{t('login.verificationCode')}</Label>
                        <Input
                          id="otp"
                          type="text"
                          inputMode="numeric"
                          autoComplete="one-time-code"
                          placeholder={t('login.codePlaceholder')}
                          value={otpCode}
                          onChange={(e) => setOtpCode(e.target.value)}
                        />
                      </div>
                      <Button
                        type="button"
                        className="w-full"
                        onClick={() => void handleVerifyCode()}
                        disabled={phoneBusy || otpCode.trim().length < 6}
                      >
                        {phoneBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />}
                        {t('login.verifySignIn')}
                      </Button>
                      <button
                        type="button"
                        className="w-full text-center text-xs text-muted-foreground underline-offset-4 hover:underline"
                        onClick={() => {
                          setConfirmation(null)
                          setOtpCode('')
                        }}
                      >
                        {t('login.differentNumber')}
                      </button>
                    </>
                  )}
                  {/* Invisible reCAPTCHA target for Firebase phone auth */}
                  <div id="phone-recaptcha" />
                </div>
              )}
            </div>

            {/* Demo quick-login — development builds only */}
            {import.meta.env.DEV && (
              <div className="space-y-3">
                <div className="flex items-center gap-3" aria-hidden="true">
                  <span className="h-px flex-1 bg-border" />
                  <span className="text-xs uppercase tracking-wider text-muted-foreground">{t('login.demoAccounts')}</span>
                  <span className="h-px flex-1 bg-border" />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {DEMO_ACCOUNTS.map(({ label, email: demoEmail, password: demoPassword, icon: Icon }) => (
                    <Button
                      key={label}
                      type="button"
                      variant="outline"
                      onClick={() => void quickLogin(demoEmail, demoPassword)}
                      disabled={anyBusy}
                    >
                      <Icon className="h-4 w-4" />
                      {t('login.loginAs', { label })}
                    </Button>
                  ))}
                </div>
              </div>
            )}

            <div className="text-center text-sm">
              {mode === 'login' ? (
                <p className="text-muted-foreground">
                  {t('login.noAccount')}{' '}
                  <button type="button" className="text-primary underline-offset-4 hover:underline" onClick={() => setMode('signup')}>
                    {t('login.signUp')}
                  </button>
                </p>
              ) : (
                <p className="text-muted-foreground">
                  {t('login.alreadyRegistered')}{' '}
                  <button type="button" className="text-primary underline-offset-4 hover:underline" onClick={() => setMode('login')}>
                    {t('login.signIn')}
                  </button>
                </p>
              )}
            </div>
          </CardContent>
        </Card>
        <p className="mt-6 text-center text-xs text-muted-foreground">
          <Link to="/" className="underline-offset-4 hover:underline">
            {t('login.backToHome')}
          </Link>
        </p>
      </div>
    </main>
  )
}
