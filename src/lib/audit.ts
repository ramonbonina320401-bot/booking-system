import { addDoc, collection } from 'firebase/firestore'

import { auth, db } from '@/lib/firebase'

// ---------------------------------------------------------------------------
// Audit log — append-only record of admin actions.
//
//   collection: audit_log/{autoId}
//   fields:     action, target_type, target_id, details, actor_uid,
//               actor_name, created_at
//
// Security: Firestore rules allow ONLY admins to read or create these docs;
// updates/deletes are denied entirely (immutable record). Non-admin writes
// are rejected server-side — this helper just wraps addDoc with the current
// actor and swallows failures (auditing must never break the main action).
// ---------------------------------------------------------------------------

export type AuditAction =
  | 'role_changed'
  | 'user_deactivated'
  | 'user_reactivated'
  | 'booking_status_changed'
  | 'booking_deleted'
  | 'announcement_created'
  | 'announcement_deleted'
  | 'resource_created'
  | 'resource_updated'
  | 'resource_deleted'
  | 'settings_updated'
  | 'booking_hours_updated'
  | 'viber_settings_updated'

interface AuditInput {
  action: AuditAction
  target_type: string
  target_id?: string | null
  details?: string
}

/**
 * Write one audit entry with the signed-in admin as the actor.
 * Fire-and-forget: never throws — an audit failure must not break the action
 * that triggered it (the rules still enforce admin-only writes).
 */
export async function logAudit(input: AuditInput): Promise<void> {
  try {
    const actor = auth.currentUser
    await addDoc(collection(db, 'audit_log'), {
      action: input.action,
      target_type: input.target_type,
      target_id: input.target_id ?? null,
      details: input.details ?? '',
      actor_uid: actor?.uid ?? null,
      actor_name: actor?.displayName ?? null,
      created_at: Date.now(),
    })
  } catch (err) {
    console.error('[audit] log failed', err instanceof Error ? err.message : err)
  }
}
