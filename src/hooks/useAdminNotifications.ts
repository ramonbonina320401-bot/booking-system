import { useEffect, useRef, useState } from 'react'
import { collection, getDocs, onSnapshot, query, where } from 'firebase/firestore'

import { useAuth } from '@/hooks/useAuth'
import { db } from '@/lib/firebase'
import type { Booking, Resource } from '@/types/booking.types'

// ---------------------------------------------------------------------------
// useAdminNotifications — real-time pending-approval feed for the admin bell.
//
// Subscribes to booking_history where status == 'pending', joins resource +
// profile names (Firestore has no JOINs), and exposes:
//  - pending       : pending bookings (newest first, names joined)
//  - needsAttention: true when a NEW pending booking arrived since the admin
//                    last opened the bell (cleared by acknowledge()).
// ---------------------------------------------------------------------------

let lastSeenIds: string[] | null = null

async function fetchResourcesMap(): Promise<Map<string, Resource>> {
  const snap = await getDocs(collection(db, 'resources'))
  const map = new Map<string, Resource>()
  for (const d of snap.docs) {
    const data = d.data() as Omit<Resource, 'id'>
    map.set(d.id, {
      id: d.id,
      name: data.name ?? '',
      description: data.description ?? null,
      is_active: data.is_active !== false,
      created_at: data.created_at ? String(data.created_at) : '',
    })
  }
  return map
}

async function fetchNamesMap(): Promise<Map<string, { full_name?: string; phone?: string | null }>> {
  const snap = await getDocs(collection(db, 'profiles'))
  const names = new Map<string, { full_name?: string; phone?: string | null }>()
  for (const d of snap.docs) {
    const data = d.data() as { full_name?: string; phone?: string | null }
    names.set(d.id, data)
  }
  return names
}

export function useAdminNotifications() {
  const { isAdmin } = useAuth()
  const [pending, setPending] = useState<Booking[]>([])
  const [needsAttention, setNeedsAttention] = useState(false)
  const seenRef = useRef<string[]>(lastSeenIds ?? [])

  useEffect(() => {
    if (!isAdmin) return

    const q = query(collection(db, 'booking_history'), where('status', '==', 'pending'))
    const unsubscribe = onSnapshot(
      q,
      (snap) => {
        const rows = snap.docs
          .map((d) => {
            const data = d.data()
            return {
              id: d.id,
              user_id: data.user_id ?? '',
              resource_id: data.resource_id ?? '',
              start_time: data.start_time ?? '',
              end_time: data.end_time ?? '',
              status: 'pending' as const,
              notes: data.notes ?? null,
              created_at: String(data.created_at ?? ''),
            } as Booking
          })
          .sort((a, b) => b.start_time.localeCompare(a.start_time))

        void Promise.all([fetchResourcesMap(), fetchNamesMap()]).then(([resources, names]) => {
          const joined = rows.map((b) => {
            const profile = names.get(b.user_id)
            return {
              ...b,
              resource: resources.get(b.resource_id) ?? null,
              user: { full_name: profile?.full_name ?? null, phone: profile?.phone ?? null },
            }
          })
          setPending(joined)

          // Alert only when a booking we've never seen before shows up.
          const known = new Set(seenRef.current)
          const fresh = joined.filter((b) => !known.has(b.id)).length > 0
          if (fresh && seenRef.current.length > 0) {
            setNeedsAttention(true)
          }
          // Remember every row we've observed (acknowledge() clears highlights,
          // but the "already seen" set only grows — no repeat rings for old rows).
          seenRef.current = joined.map((b) => b.id)
          lastSeenIds = seenRef.current
        })
      },
      // Offline / permission hiccup: keep the last known state silently.
      () => undefined
    )
    return unsubscribe
  }, [isAdmin])

  /** Called when the admin opens the bell — clears the pulse highlight. */
  const acknowledge = () => {
    setNeedsAttention(false)
  }

  return { pending, needsAttention, acknowledge }
}
