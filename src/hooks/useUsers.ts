import { useQuery } from '@tanstack/react-query'
import { collection, getDocs } from 'firebase/firestore'

import { db } from '@/lib/firebase'
import type { Profile, Role } from '@/types/user.types'

// ---------------------------------------------------------------------------
// useUsers — admin listing of every profile doc joined with a per-user booking
// count from `booking_history` (Firestore has no JOINs, so we aggregate).
//
// Emails are copied onto profile docs at sign-up so a client-only admin page
// can list them (Auth emails are not readable client-side).
// ---------------------------------------------------------------------------

export interface UserRow {
  id: string
  full_name: string | null
  role: Role
  email: string | null
  phone: string | null
  avatar_url: string | null
  active: boolean
  created_at: string
  /** Total bookings across all statuses (counted from booking_history). */
  bookingCount: number
}

const profilesCol = collection(db, 'profiles')
const historyCol = collection(db, 'booking_history')

export function useUsers() {
  return useQuery({
    queryKey: ['admin-users'],
    queryFn: async (): Promise<UserRow[]> => {
      const [profilesSnap, historySnap] = await Promise.all([
        getDocs(profilesCol),
        getDocs(historyCol),
      ])

      const counts = new Map<string, number>()
      for (const d of historySnap.docs) {
        const data = d.data() as { user_id?: string }
        if (!data.user_id) continue
        counts.set(data.user_id, (counts.get(data.user_id) ?? 0) + 1)
      }

      const rows: UserRow[] = profilesSnap.docs.map((d) => {
        const data = d.data() as Omit<Profile, 'id'>
        return {
          id: d.id,
          full_name: data.full_name ?? null,
          role: data.role === 'admin' ? 'admin' : 'user',
          email: data.email ?? null,
          phone: data.phone ?? null,
          avatar_url: data.avatar_url ?? null,
          active: data.active !== false,
          created_at: data.created_at ? String(data.created_at) : '',
          bookingCount: counts.get(d.id) ?? 0,
        }
      })

      // Newest joiners first; stable tiebreak by name.
      return rows.sort((a, b) => {
        const t = Number(b.created_at) - Number(a.created_at)
        if (t !== 0) return t
        return (a.full_name ?? '').localeCompare(b.full_name ?? '')
      })
    },
  })
}
