import { useQuery } from '@tanstack/react-query'
import { collection, getDocs, limit, orderBy, query } from 'firebase/firestore'

import { db } from '@/lib/firebase'
import type { AuditAction } from '@/lib/audit'

export interface AuditEntry {
  id: string
  action: AuditAction
  target_type: string
  target_id: string | null
  details: string
  actor_uid: string | null
  actor_name: string | null
  created_at: number
}

/** Recent audit entries, newest first. Admin-only read (rules enforce). */
export function useAuditLog(maxEntries = 50) {
  return useQuery({
    queryKey: ['audit-log'],
    queryFn: async (): Promise<AuditEntry[]> => {
      const snap = await getDocs(
        query(collection(db, 'audit_log'), orderBy('created_at', 'desc'), limit(maxEntries))
      )
      return snap.docs.map((d) => {
        const data = d.data() as Partial<AuditEntry>
        return {
          id: d.id,
          action: (data.action as AuditAction) ?? 'settings_updated',
          target_type: data.target_type ?? '',
          target_id: data.target_id ?? null,
          details: data.details ?? '',
          actor_uid: data.actor_uid ?? null,
          actor_name: data.actor_name ?? null,
          created_at: Number(data.created_at) || 0,
        }
      })
    },
    staleTime: 30_000,
  })
}
