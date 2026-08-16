/** Kind of announcement: a plain notice, or a scheduled closure with dates. */
export type AnnouncementKind = 'notice' | 'closure'

/** Mirrors the Firestore `announcements/{id}` doc. */
export interface Announcement {
  id: string
  title: string
  body: string
  kind: AnnouncementKind
  /** Inclusive range (YYYY-MM-DD local). Both null for always-on notices. */
  start_date: string | null
  end_date: string | null
  created_at: number
}
