import { useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore'

import { auth, db } from '@/lib/firebase'
import { useSettings } from '@/contexts/SettingsContext'
import { notifyAdminNewBooking } from '@/services/viber'
import { logAudit } from '@/lib/audit'
import type { Booking, BookingStatus, NewBooking, Resource } from '@/types/booking.types'

// ---------------------------------------------------------------------------
// Firestore data model (anti-double-booking design)
//
// Two collections:
//
// 1. `bookings/{resourceId}__{startISO}`  — the SLOT OCCUPANCY doc.
//    The document id is derived from resource + slot start, so two users
//    racing for the same slot both write the SAME doc — exactly one
//    `setDoc(..., { merge: false })` succeeds. This is the atomic conflict
//    point that replaces the Postgres EXCLUDE constraint.
//
// 2. `booking_history/{autoId}` — the PERMANENT RECORD (uuid doc id) with the
//    status lifecycle (pending → confirmed → completed / cancelled). Lists and
//    the admin manager read from here. Cancelling updates the history doc and
//    DELETES the slot doc, freeing the slot for rebooking while keeping history.
//
// Query notes:
//  - Reads use single-field equality filters ONLY (auto-indexed, no composite
//    indexes needed in the console) and sort client-side.
//  - Firestore rules gotcha: a read rule that references `resource.data.user_id`
//    DENIES any query that doesn't itself filter on `user_id` (the rules can't
//    prove the query only returns the caller's docs). Every user-scoped query
//    below therefore filters `user_id` in the WHERE clause and does any other
//    narrowing (e.g. resource_id) client-side.
// ---------------------------------------------------------------------------

const historyCol = collection(db, 'booking_history')
const slotCol = collection(db, 'bookings')
const resourcesCol = collection(db, 'resources')
const profilesCol = collection(db, 'profiles')

/** Deterministic slot doc id — the atomic conflict point. */
function slotId(resourceId: string, startISO: string): string {
  return `${resourceId}__${startISO}`
}

/** Thrown when the target slot is already occupied. */
export class SlotTakenError extends Error {
  constructor() {
    super('That slot is already taken.')
    this.name = 'SlotTakenError'
  }
}

function isFirebaseCode(err: unknown, code: string): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code?: string }).code === code
  )
}

async function fetchResourcesMap(): Promise<Map<string, Resource>> {
  const snap = await getDocs(resourcesCol)
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

/** Attach the joined resource to each booking (Firestore has no JOINs). */
async function withResourceJoin<T extends Booking>(rows: T[]): Promise<T[]> {
  const resources = await fetchResourcesMap()
  return rows.map((b) => ({ ...b, resource: resources.get(b.resource_id) ?? null }))
}

/** Join resources + profile name + contact phone for the admin view. */
async function withAdminJoin(rows: HistoryRow[]): Promise<Booking[]> {
  const resources = await fetchResourcesMap()
  const profileSnap = await getDocs(profilesCol)
  const profiles = new Map<string, { full_name?: string; phone?: string | null }>()
  for (const d of profileSnap.docs) {
    const data = d.data() as { full_name?: string; phone?: string | null }
    profiles.set(d.id, data)
  }
  return rows.map((b) => {
    const profile = profiles.get(b.user_id)
    return {
      ...b,
      resource: resources.get(b.resource_id) ?? null,
      user: {
        full_name: b.full_name ?? profile?.full_name ?? null,
        phone: profile?.phone ?? null,
      },
    }
  })
}

interface HistoryRow {
  id: string
  user_id: string
  resource_id: string
  start_time: string
  end_time: string
  status: BookingStatus
  notes: string | null
  created_at: string
  full_name?: string | null
}

const STATUSES: BookingStatus[] = ['pending', 'confirmed', 'cancelled', 'completed']

function mapHistory(d: { id: string; data: () => unknown }): HistoryRow {
  const data = d.data() as Omit<HistoryRow, 'id'>
  return {
    id: d.id,
    user_id: data.user_id ?? '',
    resource_id: data.resource_id ?? '',
    start_time: data.start_time ?? '',
    end_time: data.end_time ?? '',
    status: STATUSES.includes(data.status as BookingStatus) ? (data.status as BookingStatus) : 'pending',
    notes: data.notes ?? null,
    created_at: String(data.created_at ?? ''),
    full_name: data.full_name ?? null,
  }
}

/** ISO-8601 strings sort chronologically with localeCompare. */
function sortByStart(rows: HistoryRow[], dir: 'asc' | 'desc'): HistoryRow[] {
  return [...rows].sort((a, b) =>
    dir === 'asc' ? a.start_time.localeCompare(b.start_time) : b.start_time.localeCompare(a.start_time)
  )
}

/**
 * Current user's booking history (rules scope it; we filter defensively too).
 *
 * REAL-TIME: subscribes with onSnapshot so status changes made elsewhere
 * (e.g. the admin confirming a booking) show up in My Bookings immediately,
 * without a refresh. The one-shot queryFn still powers the initial load and
 * the isError/isLoading states.
 */
export function useBookings() {
  const queryClient = useQueryClient()
  const uid = auth.currentUser?.uid ?? ''

  useEffect(() => {
    if (!uid) return
    const q = query(historyCol, where('user_id', '==', uid))
    const unsubscribe = onSnapshot(
      q,
      (snap) => {
        const rows = sortByStart(snap.docs.map(mapHistory), 'desc')
        // The resource join is async — update the cache once it resolves.
        void withResourceJoin(rows).then((joined) => {
          queryClient.setQueryData(['bookings', 'mine'], joined)
        })
      },
      // Offline / permission hiccups: keep the last known data on screen.
      // The queryFn still surfaces hard errors through isError.
      () => undefined
    )
    return unsubscribe
  }, [uid, queryClient])

  return useQuery({
    queryKey: ['bookings', 'mine'],
    queryFn: async (): Promise<Booking[]> => {
      if (!uid) return []
      const q = query(historyCol, where('user_id', '==', uid))
      const snap = await getDocs(q)
      return withResourceJoin(sortByStart(snap.docs.map(mapHistory), 'desc'))
    },
  })
}

/**
 * Admin: every booking with resource + user joined.
 *
 * REAL-TIME: subscribes to the whole history collection so a user's brand-new
 * pending booking appears on the admin dashboard the moment it's created —
 * no refresh, no polling.
 */
export function useAllBookings() {
  const queryClient = useQueryClient()

  useEffect(() => {
    const unsubscribe = onSnapshot(
      historyCol,
      (snap) => {
        const rows = sortByStart(snap.docs.map(mapHistory), 'asc')
        void withAdminJoin(rows).then((joined) => {
          queryClient.setQueryData(['bookings', 'all'], joined)
        })
      },
      () => undefined
    )
    return unsubscribe
  }, [queryClient])

  return useQuery({
    queryKey: ['bookings', 'all'],
    queryFn: async (): Promise<Booking[]> => {
      const snap = await getDocs(historyCol)
      return withAdminJoin(sortByStart(snap.docs.map(mapHistory), 'asc'))
    },
  })
}

/**
 * Slot occupancy for ONE resource — drives the calendar's availability view.
 *
 * NOTE: users can only see their OWN slot docs (rules + spec: "users see only
 * their own bookings"). We query by `user_id` (rules provability) and narrow
 * to the resource client-side. Slots taken by OTHER users stay invisible —
 * the atomic slot doc (setDoc merge:false) still prevents double-booking, and
 * a conflict surfaces as SlotTakenError with a friendly toast.
 */
export function useResourceBookings(resourceId: string | null) {
  const uid = auth.currentUser?.uid ?? ''
  return useQuery({
    queryKey: ['bookings', 'resource', resourceId],
    enabled: Boolean(resourceId && uid),
    queryFn: async (): Promise<Booking[]> => {
      const q = query(slotCol, where('user_id', '==', uid))
      const snap = await getDocs(q)
      // Cancelled slot docs may linger briefly; ignore them for availability.
      const rows = sortByStart(
        snap.docs.map(mapHistory).filter((b) => b.resource_id === resourceId && b.status !== 'cancelled'),
        'asc'
      )
      return withResourceJoin(rows)
    },
  })
}

/**
 * Create a booking — atomic anti-double-booking.
 * Writes the deterministic slot doc with `merge: false` first; if it already
 * exists the write fails with 'already-exists' and we surface SlotTakenError.
 * Only after winning the slot do we write the permanent history record.
 */
export function useCreateBooking() {
  const queryClient = useQueryClient()
  const { bookingConfig } = useSettings()
  return useMutation({
    mutationFn: async (booking: NewBooking) => {
      const uid = auth.currentUser?.uid
      if (!uid) throw new Error('You must be signed in to book.')

      // Deactivated accounts cannot book (defense in depth — rules also enforce).
      const profileSnap = await getDoc(doc(profilesCol, uid))
      if (profileSnap.exists() && profileSnap.data()?.active === false) {
        throw new Error('Your account has been deactivated. Contact an administrator.')
      }

      // Closed weekday (0=Sun … 6=Sat) — reject before writing anything.
      if (bookingConfig.closedDays.includes(new Date(booking.start_time).getDay())) {
        throw new Error('That day is closed for booking.')
      }

      const slotRef = doc(slotCol, slotId(booking.resource_id, booking.start_time))
      const now = Date.now()
      // Numeric epoch millis mirror of start_time — lets the security rules
      // reject past-date bookings server-side (rules can't parse ISO strings).
      const startMs = new Date(booking.start_time).getTime()

      try {
        await setDoc(
          slotRef,
          {
            user_id: uid,
            resource_id: booking.resource_id,
            start_time: booking.start_time,
            start_ms: startMs,
            end_time: booking.end_time,
            status: 'pending',
            notes: booking.notes ?? null,
            created_at: now,
          },
          { merge: false }
        )
      } catch (err) {
        if (isFirebaseCode(err, 'already-exists')) throw new SlotTakenError()
        throw err
      }

      // Slot won — persist the permanent record.
      const historyRef = await addDoc(historyCol, {
        user_id: uid,
        resource_id: booking.resource_id,
        start_time: booking.start_time,
        start_ms: startMs,
        end_time: booking.end_time,
        status: 'pending',
        notes: booking.notes ?? null,
        created_at: now,
      })

      // Notify the admin via Viber (if configured). Fire-and-forget — a
      // Viber hiccup must never break the booking itself.
      void notifyAdminNewBooking({
        resourceId: booking.resource_id,
        startTime: booking.start_time,
        endTime: booking.end_time,
        userId: uid,
      })

      return {
        id: historyRef.id,
        user_id: uid,
        resource_id: booking.resource_id,
        start_time: booking.start_time,
        end_time: booking.end_time,
        status: 'pending',
        notes: booking.notes ?? null,
        created_at: String(now),
      } as Booking
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['bookings'] })
    },
  })
}

/** Delete the slot occupancy doc for a booking (frees the slot). */
async function freeSlot(booking: { resource_id: string; start_time: string }): Promise<void> {
  await deleteDoc(doc(slotCol, slotId(booking.resource_id, booking.start_time)))
}

async function getHistoryRow(id: string): Promise<{ resource_id: string; start_time: string }> {
  const snap = await getDoc(doc(historyCol, id))
  if (!snap.exists()) throw new Error('Booking not found.')
  const data = snap.data() as { resource_id?: string; start_time?: string }
  return { resource_id: data.resource_id ?? '', start_time: data.start_time ?? '' }
}

/** Cancel a booking (user-facing). History keeps the record; the slot frees up. */
export function useCancelBooking() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id }: { id: string }) => {
      const { resource_id, start_time } = await getHistoryRow(id)
      await updateDoc(doc(historyCol, id), { status: 'cancelled' })
      await freeSlot({ resource_id, start_time })
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['bookings'] })
    },
  })
}

/** Admin: confirm / complete / cancel. Cancelling also frees the slot. */
export function useUpdateBookingStatus() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: BookingStatus }) => {
      const { resource_id, start_time } = await getHistoryRow(id)
      await updateDoc(doc(historyCol, id), { status })
      if (status === 'cancelled') {
        await freeSlot({ resource_id, start_time })
      }
      // Audit: record admin status changes (immutable, admin-only collection).
      await logAudit({ action: 'booking_status_changed', target_type: 'booking', target_id: id, details: status })
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['bookings'] })
    },
  })
}

/** Admin: hard-delete a booking (history + slot). */
export function useDeleteBooking() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id }: { id: string }) => {
      const { resource_id, start_time } = await getHistoryRow(id)
      await deleteDoc(doc(historyCol, id))
      await freeSlot({ resource_id, start_time }).catch(() => undefined)
      await logAudit({ action: 'booking_deleted', target_type: 'booking', target_id: id })
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['bookings'] })
    },
  })
}
