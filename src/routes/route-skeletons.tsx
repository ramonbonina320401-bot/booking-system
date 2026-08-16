import { Skeleton } from '@/components/ui/skeleton'

// ---------------------------------------------------------------------------
// Route-level skeletons — one per lazy page, mirroring the real layout so a
// chunk download never flashes a generic spinner. Each wraps its content in
// `aria-hidden` with a sr-only "Loading…" label, matching the other skeletons
// in the app. The shell (navbar / admin rail + header) stays mounted because
// these render INSIDE the layouts, below <Outlet />.
// ---------------------------------------------------------------------------

/** Centered login card — mirrors LoginPage. */
export function LoginSkeleton() {
  return (
    <main
      className="flex min-h-dvh items-center justify-center px-4 py-12"
      style={{ backgroundColor: 'var(--app-background)' }}
      aria-hidden="true"
    >
      <div className="w-full max-w-sm space-y-4">
        <div className="mb-2 flex justify-center">
          <Skeleton className="h-8 w-40 rounded-lg" />
        </div>
        <div className="rounded-2xl border bg-card p-6 shadow-sm">
          <Skeleton className="h-6 w-28 rounded-md" />
          <Skeleton className="mt-6 h-4 w-16 rounded-md" />
          <Skeleton className="mt-2 h-10 w-full rounded-xl" />
          <Skeleton className="mt-4 h-4 w-20 rounded-md" />
          <Skeleton className="mt-2 h-10 w-full rounded-xl" />
          <Skeleton className="mt-5 h-10 w-full rounded-xl" />
        </div>
        <div className="flex justify-center gap-2">
          <Skeleton className="h-9 w-32 rounded-xl" />
          <Skeleton className="h-9 w-32 rounded-xl" />
        </div>
      </div>
      <span className="sr-only">Loading…</span>
    </main>
  )
}

/** Three-step booking form card — mirrors BookingForm. */
export function BookingSkeleton() {
  return (
    <div className="mx-auto w-full max-w-3xl" aria-hidden="true">
      <Skeleton className="h-4 w-20 rounded-full" />
      <Skeleton className="mt-2 h-9 w-56 rounded-xl" />
      <div className="mt-6 rounded-2xl border bg-card p-6 shadow-sm">
        <Skeleton className="h-4 w-24 rounded-md" />
        <div className="mt-3 flex gap-1">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-1.5 flex-1 rounded-full" />
          ))}
        </div>
        <Skeleton className="mt-5 h-4 w-44 rounded-md" />
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-2xl border p-4">
              <div className="flex items-center gap-3">
                <Skeleton className="h-10 w-10 rounded-full" />
                <Skeleton className="h-5 w-32 rounded-md" />
              </div>
              <Skeleton className="mt-3 h-4 w-3/4 rounded-md" />
            </div>
          ))}
        </div>
        <div className="mt-6 flex items-center justify-between">
          <Skeleton className="h-10 w-24 rounded-xl" />
          <Skeleton className="h-10 w-24 rounded-xl" />
        </div>
      </div>
      <span className="sr-only">Loading…</span>
    </div>
  )
}

/** Profile header + two form cards — mirrors ProfilePage. */
export function ProfileSkeleton() {
  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-10" aria-hidden="true">
      <Skeleton className="h-4 w-24 rounded-full" />
      <Skeleton className="mt-2 h-9 w-48 rounded-xl" />
      <div className="mt-8 rounded-2xl border bg-card p-8">
        <div className="flex items-center gap-5">
          <Skeleton className="h-20 w-20 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-5 w-44 rounded-md" />
            <Skeleton className="h-4 w-64 rounded-md" />
            <Skeleton className="h-4 w-40 rounded-md" />
          </div>
        </div>
      </div>
      <div className="mt-6 rounded-2xl border bg-card p-6">
        <Skeleton className="h-5 w-36 rounded-md" />
        <Skeleton className="mt-4 h-10 w-full rounded-xl" />
        <div className="mt-4 flex justify-end">
          <Skeleton className="h-10 w-28 rounded-xl" />
        </div>
      </div>
      <div className="mt-6 rounded-2xl border bg-card p-6">
        <Skeleton className="h-5 w-40 rounded-md" />
        <Skeleton className="mt-4 h-12 w-full rounded-xl" />
        <Skeleton className="mt-4 h-10 w-44 rounded-xl" />
      </div>
      <span className="sr-only">Loading…</span>
    </main>
  )
}

/** Header + stat pills + two side-by-side cards — mirrors MyBookingsPage. */
export function MyBookingsSkeleton() {
  return (
    <main className="mx-auto max-w-5xl px-4 py-10" aria-hidden="true">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <Skeleton className="h-4 w-24 rounded-full" />
          <Skeleton className="mt-2 h-9 w-56 rounded-xl" />
        </div>
        <Skeleton className="h-10 w-40 rounded-xl" />
      </div>
      <div className="mb-6 flex flex-wrap gap-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-9 w-40 rounded-full" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {[0, 1].map((col) => (
          <div key={col} className="rounded-2xl border bg-card p-6">
            <Skeleton className="h-5 w-28 rounded-md" />
            <div className="mt-4 space-y-3">
              {Array.from({ length: 2 }).map((_, i) => (
                <Skeleton key={i} className="h-24 w-full rounded-xl" />
              ))}
            </div>
          </div>
        ))}
      </div>
      <span className="sr-only">Loading…</span>
    </main>
  )
}

/** Header + KPI row + charts + recent list — mirrors AdminDashboard. */
export function AdminDashboardSkeleton() {
  return (
    <div className="mx-auto max-w-7xl space-y-6" aria-hidden="true">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Skeleton className="h-4 w-20 rounded-full" />
          <Skeleton className="mt-2 h-9 w-64 rounded-xl" />
          <Skeleton className="mt-2 h-4 w-72 rounded-md" />
        </div>
        <Skeleton className="h-10 w-64 rounded-full" />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-2xl border bg-card p-6">
            <div className="flex items-center gap-3">
              <Skeleton className="h-10 w-10 rounded-full" />
              <Skeleton className="h-4 w-24 rounded-md" />
            </div>
            <Skeleton className="mt-4 h-10 w-16 rounded-lg" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Skeleton className="h-72 rounded-2xl xl:col-span-2" />
        <Skeleton className="h-72 rounded-2xl" />
      </div>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="rounded-2xl border bg-card p-6 xl:col-span-2">
          <Skeleton className="h-5 w-40 rounded-md" />
          <div className="mt-4 space-y-2.5">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full rounded-2xl" />
            ))}
          </div>
        </div>
        <div className="rounded-2xl border bg-card p-6">
          <Skeleton className="h-5 w-32 rounded-md" />
          <div className="mt-4 space-y-2.5">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full rounded-2xl" />
            ))}
          </div>
        </div>
      </div>
      <span className="sr-only">Loading…</span>
    </div>
  )
}

type AdminPageVariant = 'table' | 'cards' | 'form'

/** Header + variant-specific content — mirrors the admin sub-pages
 * (bookings table / resources cards / settings form). The header itself is
 * skeleton bars (the real title/description live in the lazy page). */
export function AdminPageSkeleton({ variant }: { variant: AdminPageVariant }) {
  return (
    <div className="space-y-6" aria-hidden="true">
      <div>
        <Skeleton className="h-3 w-24 rounded-full" />
        <Skeleton className="mt-2 h-8 w-44 rounded-xl" />
        <Skeleton className="mt-2 h-4 w-72 rounded-md" />
      </div>
      {variant === 'table' && (
        <>
          <Skeleton className="h-10 w-full rounded-xl" />
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full rounded-lg" />
            ))}
          </div>
        </>
      )}
      {variant === 'cards' && (
        <div className="grid gap-3 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-2xl" />
          ))}
        </div>
      )}
      {variant === 'form' && (
        <div className="space-y-4">
          <Skeleton className="h-24 w-full rounded-2xl" />
          <Skeleton className="h-24 w-full rounded-2xl" />
          <Skeleton className="h-40 w-full rounded-2xl" />
        </div>
      )}
      <span className="sr-only">Loading…</span>
    </div>
  )
}
