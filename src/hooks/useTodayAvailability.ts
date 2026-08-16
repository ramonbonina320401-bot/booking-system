import { useQuery } from '@tanstack/react-query'
import { collection, getDocs, query, where } from 'firebase/firestore'
import { addDays, startOfToday } from 'date-fns'

import { db } from '@/lib/firebase'
import { useSettings } from '@/contexts/SettingsContext'
import { buildTimeSlots } from '@/lib/timeSlots'

/**
 * Today's free-slot counts per resource, computed from the `bookings`
 * collection (the slot docs that also drive the booking calendar).
 *
 * NOTE on security: the Firestore rules only let a regular user read their
 * OWN slot docs ("users see only their own bookings"). That means this query
 * succeeds for admins (real counts across all users) but is rejected for
 * regular users/guests. The Home page shows real numbers when available and
 * falls back to a neutral "Open today" pill otherwise — it never lies by
 * showing a count computed from incomplete data.
 */
export function useTodayAvailability() {
  const { bookingConfig } = useSettings()
  return useQuery({
    queryKey: ['availability', 'today', bookingConfig],
    queryFn: async (): Promise<Record<string, number>> => {
      const today = startOfToday()
      const tomorrow = addDays(today, 1)

      // Both bounds are local-midnight → UTC ISO, matching how buildTimeSlots
      // persists start_time values, so the range covers exactly "today" in
      // the viewer's timezone.
      const [snap, resourcesSnap] = await Promise.all([
        getDocs(
          query(
            collection(db, 'bookings'),
            where('start_time', '>=', today.toISOString()),
            where('start_time', '<', tomorrow.toISOString())
          )
        ),
        // Count free slots for EVERY active resource — a resource with no
        // bookings today has all its slots free, not zero.
        getDocs(query(collection(db, 'resources'), where('is_active', '==', true))),
      ])

      const byResource = new Map<string, { start_time: string; end_time: string; status: string }[]>()
      for (const docSnap of snap.docs) {
        const d = docSnap.data() as {
          resource_id?: string
          start_time?: string
          end_time?: string
          status?: string
        }
        if (!d.resource_id || !d.start_time || d.status === 'cancelled') continue
        const arr = byResource.get(d.resource_id) ?? []
        arr.push({ start_time: d.start_time, end_time: d.end_time ?? '', status: d.status ?? '' })
        byResource.set(d.resource_id, arr)
      }

      const counts: Record<string, number> = {}
      for (const resDoc of resourcesSnap.docs) {
        const existing = byResource.get(resDoc.id) ?? []
        counts[resDoc.id] = buildTimeSlots(today, existing, bookingConfig).filter((s) => !s.taken).length
      }
      return counts
    },
    retry: false,
    staleTime: 60_000,
  })
}
