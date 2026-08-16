import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { addDoc, collection, deleteDoc, doc, getDocs } from 'firebase/firestore'

import { auth, db } from '@/lib/firebase'
import { logAudit } from '@/lib/audit'
import type { Announcement, AnnouncementKind } from '@/types/announcement.types'

const col = collection(db, 'announcements')

/** Local date as YYYY-MM-DD (calendar days are local, not UTC). */
function toDateKey(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function parse(docData: { id: string; data: Record<string, unknown> }): Announcement | null {
  const data = docData.data
  const title = typeof data.title === 'string' ? data.title.trim() : ''
  if (!title) return null
  return {
    id: docData.id,
    title,
    body: typeof data.body === 'string' ? data.body : '',
    kind: data.kind === 'closure' ? 'closure' : 'notice',
    start_date: typeof data.start_date === 'string' ? data.start_date : null,
    end_date: typeof data.end_date === 'string' ? data.end_date : null,
    created_at: Number(data.created_at) || 0,
  }
}

/** A closure is active while `now` falls inside its range; notices are always active. */
export function isAnnouncementActive(a: Announcement, now: Date = new Date()): boolean {
  if (a.kind === 'notice') return true
  if (!a.start_date && !a.end_date) return true
  const key = toDateKey(now)
  const start = a.start_date ?? a.end_date ?? key
  const end = a.end_date ?? a.start_date ?? key
  return start <= key && key <= end
}

/** Only the announcements users should see right now. */
export function activeAnnouncements(list: Announcement[], now: Date = new Date()): Announcement[] {
  return list.filter((a) => isAnnouncementActive(a, now))
}

/**
 * Announcements shown in the banner: notices always; closures when currently
 * in effect OR starting within the next 30 days (so users get a heads-up and
 * understand why those calendar dates are blocked).
 */
export function visibleAnnouncements(list: Announcement[], now: Date = new Date()): Announcement[] {
  const horizon = new Date(now)
  horizon.setDate(horizon.getDate() + 30)
  return list.filter((a) => {
    if (a.kind === 'notice') return true
    if (!a.start_date) return true
    const startKey = a.start_date
    const endKey = a.end_date ?? a.start_date
    const todayKey = toDateKey(now)
    if (endKey < todayKey) return false // already over — nothing to show
    return startKey <= todayKey || startKey <= toDateKey(horizon)
  })
}

/** Closure ranges (inclusive YYYY-MM-DD) to feed buildTimeSlots. */
export function closureRangesFor(list: Announcement[]): { start: string; end: string }[] {
  const ranges: { start: string; end: string }[] = []
  for (const a of list) {
    if (a.kind !== 'closure' || !a.start_date || !a.end_date) continue
    ranges.push({ start: a.start_date, end: a.end_date })
  }
  return ranges
}

/** Format an inclusive YYYY-MM-DD range for display, e.g. "Aug 21 – Aug 22". */
export function formatDateRange(start: string | null, end: string | null): string {
  const fmt = (key: string) => {
    const d = new Date(`${key}T00:00:00`)
    if (Number.isNaN(d.getTime())) return key
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  }
  if (start && end) return start === end ? fmt(start) : `${fmt(start)} – ${fmt(end)}`
  return fmt(start ?? end ?? '')
}

export function useAnnouncements() {
  return useQuery({
    queryKey: ['announcements'],
    queryFn: async (): Promise<Announcement[]> => {
      const snap = await getDocs(col)
      const list: Announcement[] = []
      for (const d of snap.docs) {
        const parsed = parse({ id: d.id, data: d.data() as Record<string, unknown> })
        if (parsed) list.push(parsed)
      }
      // Newest first.
      return list.sort((a, b) => b.created_at - a.created_at)
    },
  })
}

export function useAddAnnouncement() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: {
      title: string
      body: string
      kind: AnnouncementKind
      start_date: string | null
      end_date: string | null
    }) => {
      const ref = await addDoc(col, {
        title: input.title.trim(),
        body: input.body.trim(),
        kind: input.kind,
        start_date: input.kind === 'closure' ? input.start_date : null,
        end_date: input.kind === 'closure' ? input.end_date : null,
        created_at: Date.now(),
        created_by: auth.currentUser?.uid ?? null,
      })
      await logAudit({
        action: 'announcement_created',
        target_type: 'announcement',
        target_id: ref.id,
        details: input.title.trim(),
      })
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['announcements'] }),
  })
}

export function useDeleteAnnouncement() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      await deleteDoc(doc(db, 'announcements', id))
      await logAudit({ action: 'announcement_deleted', target_type: 'announcement', target_id: id })
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['announcements'] }),
  })
}
