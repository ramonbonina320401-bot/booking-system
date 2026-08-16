import { lazy, Suspense, useEffect } from 'react'
import { BrowserRouter, Navigate, Outlet, Route, Routes, useLocation } from 'react-router'
import { toast } from 'sonner'

import { useAuth } from '@/hooks/useAuth'
import { useIdleSignOut } from '@/hooks/useIdleSignOut'
import { useMaintenanceGuard } from '@/hooks/useMaintenanceGuard'
import { useI18n, tr } from '@/lib/i18n'
import { flushDirtySettings } from '@/lib/settingsAutosave'
import { Navbar } from '@/components/layout/Navbar'
import { MobileTabBar } from '@/components/layout/MobileTabBar'
import { AdminMobileTabBar } from '@/components/layout/AdminMobileTabBar'
import { Sidebar } from '@/components/layout/Sidebar'
import { AdminHeader } from '@/components/layout/AdminHeader'
import { InstallBanner } from '@/components/layout/InstallBanner'
import { ConnectivityBanner } from '@/components/layout/ConnectivityBanner'
import { BookingReminderListener } from '@/components/layout/BookingReminderListener'
import { RouteProgressBar } from '@/components/layout/RouteProgressBar'
import { LoadingSignal } from '@/components/layout/LoadingSignal'
import { MaintenanceScreen } from '@/components/layout/MaintenanceScreen'
import { OnboardingWalkthrough } from '@/components/layout/OnboardingWalkthrough'
import { FirstBookingCelebration } from '@/components/celebration/FirstBookingCelebration'
import { HomePage } from '@/pages/HomePage'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import {
  LoginSkeleton,
  ProfileSkeleton,
  BookingSkeleton,
  MyBookingsSkeleton,
  AdminDashboardSkeleton,
  AdminPageSkeleton,
} from '@/routes/route-skeletons'

// ---------------------------------------------------------------------------
// Route-level code splitting — each page is its own lazy chunk.
//   - HomePage stays eager: it's the landing route, so the first paint has
//     zero extra round-trips and no skeleton flash.
//   - Everything else lazy-loads on demand. Heavy deps stay out of the
//     initial bundle: recharts (admin dashboard) and react-day-picker (booking
//     calendar) only download when their route is actually visited.
//   - Each lazy element carries its own <Suspense> with a route-specific
//     skeleton (see route-skeletons.tsx), so the layout shell (navbar / admin
//     rail + header) stays mounted while the chunk downloads — no flash.
// ---------------------------------------------------------------------------
const LoginPage = lazy(() => import('@/pages/LoginPage').then((m) => ({ default: m.LoginPage })))
const ProfilePage = lazy(() => import('@/pages/ProfilePage').then((m) => ({ default: m.ProfilePage })))
const BookingPage = lazy(() => import('@/pages/BookingPage').then((m) => ({ default: m.BookingPage })))
const MyBookingsPage = lazy(() =>
  import('@/pages/MyBookingsPage').then((m) => ({ default: m.MyBookingsPage }))
)
const BookingSuccessPage = lazy(() =>
  import('@/pages/BookingSuccessPage').then((m) => ({ default: m.BookingSuccessPage }))
)
const AdminDashboard = lazy(() =>
  import('@/pages/admin/AdminDashboard').then((m) => ({ default: m.AdminDashboard }))
)
const AdminSettingsPage = lazy(() =>
  import('@/pages/admin/AdminSettingsPage').then((m) => ({ default: m.AdminSettingsPage }))
)
const AdminBookingsPage = lazy(() =>
  import('@/pages/admin/AdminBookingsPage').then((m) => ({ default: m.AdminBookingsPage }))
)
const AdminResourcesPage = lazy(() =>
  import('@/pages/admin/AdminResourcesPage').then((m) => ({ default: m.AdminResourcesPage }))
)
const AdminUsersPage = lazy(() =>
  import('@/pages/admin/AdminUsersPage').then((m) => ({ default: m.AdminUsersPage }))
)
// Push foreground toasts only matter for users who enabled FCM — mounting it
// conditionally (and lazy) keeps firebase/messaging OUT of the first-load
// bundle entirely (see PushForegroundListener for the dynamic import note).
const PushForegroundListener = lazy(() =>
  import('@/components/layout/PushForegroundListener').then((m) => ({ default: m.PushForegroundListener }))
)

/** Renders the foreground push listener only when the user has a device
 *  push token (i.e. they enabled notifications). */
function PushListenerGate() {
  const { profile } = useAuth()
  if (!profile?.fcm_token) return null
  return (
    <Suspense fallback={null}>
      <PushForegroundListener />
    </Suspense>
  )
}

// ---------------------------------------------------------------------------
// AppRouter — all routes + guards in one place.
//   AppGate        → maintenance mode (blocks non-admins)
//   PublicLayout   → navbar + content (public pages)
//   AdminLayout    → dashboard shell: dark icon rail + header + dot-grid area
//   RequireAuth    → must be signed in
//   RequireAdmin   → must have role === 'admin'
// ---------------------------------------------------------------------------

/** Branded route loader — skeleton shell that mirrors the public layout
 * (navbar + dot-grid hero). Used while the auth/maintenance guard checks run,
 * so those never flash a bare spinner. */
function PageLoader() {
  return (
    <LoadingSignal>
      <div className="flex min-h-dvh flex-col">
        <div className="flex h-16 items-center justify-between border-b bg-background/90 px-4">
          <Skeleton className="h-9 w-32 rounded-lg" />
          <div className="hidden items-center gap-2 md:flex">
            <Skeleton className="h-9 w-16 rounded-full" />
            <Skeleton className="h-9 w-24 rounded-full" />
            <Skeleton className="h-9 w-16 rounded-full" />
          </div>
        </div>
        <div className="dot-grid flex-1 bg-background">
          <div className="mx-auto w-full max-w-5xl space-y-6 px-4 py-10">
            <Skeleton className="h-4 w-28 rounded-full" />
            <Skeleton className="h-11 w-72 rounded-xl" />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-44 rounded-2xl" />
              ))}
            </div>
            <Skeleton className="h-64 rounded-2xl" />
          </div>
        </div>
        <span className="sr-only">Loading…</span>
      </div>
    </LoadingSignal>
  )
}

/** Maintenance gate: while settings/auth load we wait; if maintenance is on
 * and the user isn't an admin, they only ever see the MaintenanceScreen. */
function AppGate() {
  const { blocked, checking } = useMaintenanceGuard()
  const location = useLocation()
  if (checking) return <PageLoader />
  // Keep /login reachable during maintenance so a logged-out admin can still
  // authenticate and turn the mode off. Regular users remain blocked after
  // signing in (they land on the maintenance screen, not the app).
  if (blocked && location.pathname !== '/login') return <MaintenanceScreen />
  return <Outlet />
}

function PublicLayout() {
  const location = useLocation()
  return (
    <div className="dot-grid min-h-dvh">
      <Navbar />
      {/* keyed by pathname → the fade-in replays on every route change */}
      {/* pb clears the fixed mobile tab bar AND the install banner on phones */}
      <div key={location.pathname} className="page-fade-in pb-40 md:pb-0">
        <Outlet />
      </div>
      {/* Native-app bottom tabs — mobile only */}
      <MobileTabBar />
      {/* Prominent mobile install/download prompt above the tab bar */}
      <InstallBanner />
    </div>
  )
}

/** Dashboard shell — dark icon rail + top header + dot-grid content area. */
function AdminLayout() {
  const location = useLocation()

  // Auto-save dirty settings when the admin navigates away from the Settings
  // panel. BrowserRouter has no useBlocker, so the draft lives in a module-
  // level store + flusher (registered by SettingsPanel) — the save still runs
  // after the panel unmounts. A no-op when the draft is clean or the panel was
  // never visited.
  useEffect(() => {
    let cancelled = false
    void flushDirtySettings().then((ok) => {
      if (!ok && !cancelled) toast.error(tr('st.autoSaveFailed'))
    })
    return () => {
      cancelled = true
    }
  }, [location.pathname])

  return (
    <div className="flex min-h-dvh">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <AdminHeader />
        {/* pb clears the fixed mobile tab bar on phones */}
        <main className="dot-grid flex-1 bg-background px-4 py-6 pb-24 sm:px-6 md:pb-6 lg:px-8">
          <div key={location.pathname} className="page-fade-in">
            <Outlet />
          </div>
        </main>
      </div>
      {/* Native-app bottom tabs — admin, mobile only */}
      <AdminMobileTabBar />
      {/* Prominent mobile install/download prompt above the tab bar */}
      <InstallBanner />
    </div>
  )
}

function RequireAuth() {
  const { user, isLoading } = useAuth()
  const location = useLocation()
  if (isLoading) return <PageLoader />
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />
  return <Outlet />
}

function RequireAdmin() {
  const { user, isLoading, isAdmin } = useAuth()
  if (isLoading) return <PageLoader />
  if (!user) return <Navigate to="/login" replace />
  if (!isAdmin) return <Navigate to="/" replace />
  return <Outlet />
}

function NotFound() {
  const { t } = useI18n()
  return (
    <main className="flex min-h-[60dvh] flex-col items-center justify-center gap-4 text-center">
      <h1 className="text-3xl font-bold">404</h1>
      <p className="text-muted-foreground">{t('misc.notFound')}</p>
      <Button asChild variant="outline">
        <a href="/">{t('misc.goHome')}</a>
      </Button>
    </main>
  )
}

export function AppRouter() {
  // Security hygiene: sign out after 15 min without interaction (shared devices).
  useIdleSignOut()
  return (
    <BrowserRouter>
      {/* Global celebration overlay — shows over any page on first booking */}
      <FirstBookingCelebration />
      {/* Toast for push notifications received while the app is open —
          only mounts for users who enabled push (keeps messaging out of
          the initial bundle). */}
      <PushListenerGate />
      {/* Client-side booking reminders — toast + system notification when a
          confirmed booking is about to start (works on the free plan, no
          Cloud Function deployment needed). No-ops for signed-out users. */}
      <BookingReminderListener />
      {/* Offline connectivity banner — top of the screen while the device is offline */}
      <ConnectivityBanner />
      {/* Thin route-loading progress bar — pinned above everything */}
      <RouteProgressBar />
      {/* First-time mobile walkthrough — shows once, dismissible */}
      <OnboardingWalkthrough />
      <Routes>
        {/* Everything sits behind the maintenance gate */}
        <Route element={<AppGate />}>
          <Route
            path="/login"
            element={
              <Suspense fallback={<LoadingSignal><LoginSkeleton /></LoadingSignal>}>
                <LoginPage />
              </Suspense>
            }
          />

          <Route element={<PublicLayout />}>
            <Route path="/" element={<HomePage />} />

            <Route element={<RequireAuth />}>
              <Route
                path="/profile"
                element={
                  <Suspense fallback={<LoadingSignal><ProfileSkeleton /></LoadingSignal>}>
                    <ProfilePage />
                  </Suspense>
                }
              />
              <Route
                path="/book"
                element={
                  <Suspense fallback={<LoadingSignal><BookingSkeleton /></LoadingSignal>}>
                    <BookingPage />
                  </Suspense>
                }
              />
              <Route
                path="/my-bookings"
                element={
                  <Suspense fallback={<LoadingSignal><MyBookingsSkeleton /></LoadingSignal>}>
                    <MyBookingsPage />
                  </Suspense>
                }
              />
              <Route
                path="/booking-success"
                element={
                  <Suspense fallback={<LoadingSignal><ProfileSkeleton /></LoadingSignal>}>
                    <BookingSuccessPage />
                  </Suspense>
                }
              />
            </Route>

            <Route path="*" element={<NotFound />} />
          </Route>

          {/* Admin area lives OUTSIDE PublicLayout — its own shell (icon rail +
              header), no public navbar stacked on top. */}
          <Route element={<RequireAdmin />}>
            <Route path="/admin" element={<AdminLayout />}>
              <Route
                index
                element={
                  <Suspense fallback={<LoadingSignal><AdminDashboardSkeleton /></LoadingSignal>}>
                    <AdminDashboard />
                  </Suspense>
                }
              />
              <Route
                path="bookings"
                element={
                  <Suspense fallback={<LoadingSignal><AdminPageSkeleton variant="table" /></LoadingSignal>}>
                    <AdminBookingsPage />
                  </Suspense>
                }
              />
              <Route
                path="resources"
                element={
                  <Suspense fallback={<LoadingSignal><AdminPageSkeleton variant="cards" /></LoadingSignal>}>
                    <AdminResourcesPage />
                  </Suspense>
                }
              />
              <Route
                path="settings"
                element={
                  <Suspense fallback={<LoadingSignal><AdminPageSkeleton variant="form" /></LoadingSignal>}>
                    <AdminSettingsPage />
                  </Suspense>
                }
              />
              <Route
                path="users"
                element={
                  <Suspense fallback={<LoadingSignal><AdminPageSkeleton variant="table" /></LoadingSignal>}>
                    <AdminUsersPage />
                  </Suspense>
                }
              />
            </Route>
          </Route>
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
