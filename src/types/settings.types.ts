export type SettingValueType = 'string' | 'color' | 'boolean' | 'number' | 'image' | 'days'

/**
 * A setting doc in the `system_settings` Firestore collection (doc id = key).
 * `value` is stored with its native type (Firestore supports boolean/number),
 * so no string parsing is needed at runtime.
 */
export interface SystemSetting {
  key: string
  value: string | boolean | number | number[] | null
  value_type: SettingValueType
  updated_by: string | null
  updated_at: number | null
}

/** Convenience map: setting key -> doc. */
export type SettingsMap = Record<string, SystemSetting>

/** All keys used by the app — keep in sync with the seed script. */
export const SETTING_KEYS = [
  'maintenance_mode',
  'maintenance_message',
  'logo_url',
  'logo_width',
  'logo_height',
  'primary_color',
  'background_color',
  'accent_color',
  'app_name',
  'viber_enabled',
  'viber_token',
  'viber_admin_id',
  'booking_open_hour',
  'booking_close_hour',
  'slot_duration_minutes',
  'booking_closed_days',
  'booking_reminder_minutes',
  'booking_reminder_days',
] as const

export type SettingKey = (typeof SETTING_KEYS)[number]

/** The branding subset, used by SettingsContext to apply CSS vars. */
export interface BrandingValues {
  appName: string
  logoUrl: string
  logoWidth: number
  logoHeight: number
  primaryColor: string
  backgroundColor: string
  accentColor: string
}
