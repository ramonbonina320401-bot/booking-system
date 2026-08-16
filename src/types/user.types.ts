export type Role = 'admin' | 'user'

/** Mirrors the Firestore `profiles/{uid}` doc (extends Firebase Auth users). */
export interface Profile {
  id: string
  full_name: string | null
  role: Role
  /** Email copied onto the profile doc so client-side admin pages can list it (Auth emails are not readable client-side). */
  email?: string | null
  /** Contact phone stored on the profile doc (may differ from the sign-in phone). */
  phone?: string | null
  /** Whether the account can book. Admin-set; missing/undefined means active. */
  active?: boolean
  /** Avatar photo stored as a base64 data URL on the profile doc (free plan friendly). */
  avatar_url?: string | null
  /** FCM device token for web push notifications (profile doc). */
  fcm_token?: string | null
  created_at: string
}

/** The authenticated user + their profile (role lives in profiles, not auth claims). */
export interface AppUser {
  id: string
  email: string
  /** Present for phone-number sign-ins (Viber/phone users). */
  phone?: string | null
  /** Whether the sign-in email is verified (phone-only users have no email). */
  emailVerified: boolean
  profile: Profile | null
}
