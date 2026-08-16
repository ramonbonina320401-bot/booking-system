import { useSettings } from '@/contexts/SettingsContext'
import { useAuth } from '@/hooks/useAuth'

// ---------------------------------------------------------------------------
// useMaintenanceGuard — frontend layer of maintenance mode.
//
// When maintenance_mode is ON and the current user is NOT an admin, the app
// shows the MaintenanceScreen instead of the normal UI. Admins are never
// blocked so they can turn the mode back off.
//
// Backend layer: a Postgres trigger on `bookings` blocks INSERT/UPDATE while
// maintenance is on (see supabase/migrations) — the frontend alone cannot be
// trusted to enforce this.
// ---------------------------------------------------------------------------

export function useMaintenanceGuard() {
  const { isMaintenance, isLoaded } = useSettings()
  const { user, isLoading: authLoading } = useAuth()

  const isAdmin = user?.profile?.role === 'admin'

  // Blocked only once settings are known, maintenance is on, and the user is
  // not an admin. While loading we render nothing meaningful yet.
  const blocked = isLoaded && isMaintenance && !isAdmin

  return { blocked, checking: !isLoaded || authLoading, isAdmin, isMaintenance }
}
