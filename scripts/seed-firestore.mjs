#!/usr/bin/env node
/**
 * seed-firestore.mjs — seeds defaults, demo users, and sample data.
 * Uses the Firebase Admin SDK, so it bypasses security rules (run it locally —
 * never ship the service account key).
 *
 * Usage:
 *   node scripts/seed-firestore.mjs \
 *     --service-account ./serviceAccountKey.json \
 *     [--admin-email you@example.com] \
 *     [--demo-users]
 *
 *   --demo-users  creates two test accounts with known credentials:
 *                 admin@booking.test / Admin123!   (role: admin)
 *                 user@booking.test   / User123!   (role: user)
 *                 plus sample bookings for the regular user — both upcoming
 *                 AND a few historical ones so the analytics charts have data.
 *                 Safe to re-run — existing users/slots are reused, not duplicated.
 *
 * Get the service account key: Firebase console → Project settings →
 * Service accounts → Generate new private key.
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { initializeApp, cert } from 'firebase-admin/app'
import { getFirestore, FieldValue } from 'firebase-admin/firestore'
import { getAuth } from 'firebase-admin/auth'

const args = process.argv.slice(2)
const arg = (name) => {
  const i = args.indexOf(name)
  return i >= 0 ? args[i + 1] : undefined
}
const hasFlag = (name) => args.includes(name)

const serviceAccountPath = arg('--service-account')
if (!serviceAccountPath) {
  console.error('Missing --service-account <path-to-serviceAccountKey.json>')
  process.exit(1)
}

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const serviceAccount = JSON.parse(readFileSync(join(ROOT, serviceAccountPath), 'utf8'))

initializeApp({ credential: cert(serviceAccount) })
const db = getFirestore()
const auth = getAuth()

// ---------------------------------------------------------------------------
// Defaults — NOTE: background_color is the reference's off-white shell (#fafaf8),
// not pure white, so the dot-grid texture reads properly.
const DEFAULTS = [
  { key: 'maintenance_mode', value: false, value_type: 'boolean' },
  { key: 'maintenance_message', value: 'We are currently performing maintenance. Please check back soon.', value_type: 'string' },
  { key: 'logo_url', value: '', value_type: 'image' },
  { key: 'logo_width', value: 120, value_type: 'number' },
  { key: 'logo_height', value: 40, value_type: 'number' },
  { key: 'primary_color', value: '#2563eb', value_type: 'color' },
  { key: 'background_color', value: '#fafaf8', value_type: 'color' },
  { key: 'accent_color', value: '#f59e0b', value_type: 'color' },
  { key: 'app_name', value: 'Booking System', value_type: 'string' },
  { key: 'viber_enabled', value: false, value_type: 'boolean' },
  { key: 'viber_token', value: '', value_type: 'string' },
  { key: 'viber_admin_id', value: '', value_type: 'string' },
  { key: 'booking_open_hour', value: 8, value_type: 'number' },
  { key: 'booking_close_hour', value: 18, value_type: 'number' },
  { key: 'slot_duration_minutes', value: 60, value_type: 'number' },
  { key: 'booking_closed_days', value: [], value_type: 'days' },
  { key: 'booking_reminder_minutes', value: 30, value_type: 'number' },
  { key: 'booking_reminder_days', value: 0, value_type: 'number' },
]

const RESOURCES = [
  { name: 'Meeting Room A', description: 'Conference room, seats 8, projector available.', is_active: true },
  { name: 'Meeting Room B', description: 'Small huddle room, seats 4.', is_active: true },
  { name: 'Projector', description: 'Portable HD projector with HDMI/USB-C.', is_active: true },
]

const DEMO_USERS = [
  { email: 'admin@booking.test', password: 'Admin123!', full_name: 'Admin User', role: 'admin' },
  { email: 'user@booking.test', password: 'User123!', full_name: 'Regular User', role: 'user' },
]

/** Day at hour (local time), returned as a Date. */
function at(daysFromNow, hour, minute = 0) {
  const d = new Date()
  d.setDate(d.getDate() + daysFromNow)
  d.setHours(hour, minute, 0, 0)
  return d
}

/**
 * Demo bookings for the regular user. Mix of:
 *  - historical (last week) → fills the analytics charts
 *  - upcoming (next days)   → fills "Upcoming" + "Next booking" + My Bookings
 */
function demoBookingSlots() {
  const b = (resource, daysFromNow, hour, minute, status, notes = null) => {
    const start = at(daysFromNow, hour, minute)
    const end = new Date(start)
    end.setHours(end.getHours() + 1)
    return { resource, start, end, status, notes }
  }

  return [
    // Historical — chart data
    b('Meeting Room A', -6, 10, 0, 'completed', 'Onboarding session'),
    b('Projector', -5, 13, 0, 'confirmed', 'Product demo'),
    b('Meeting Room B', -4, 9, 30, 'completed', null),
    b('Meeting Room A', -3, 15, 0, 'cancelled', 'Cancelled by user'),
    b('Meeting Room B', -2, 11, 0, 'completed', '1:1 sync'),
    b('Projector', -1, 14, 0, 'confirmed', 'Q3 planning'),
    // Upcoming — My Bookings / dashboard
    b('Meeting Room A', 1, 9, 0, 'pending', 'Weekly sync — demo data'),
    b('Meeting Room B', 2, 14, 0, 'confirmed', null),
  ]
}

async function ensureUser({ email, password, full_name }) {
  try {
    return await auth.getUserByEmail(email) // exists → reuse
  } catch {
    return auth.createUser({ email, password, displayName: full_name })
  }
}

async function resourcesByName() {
  const snap = await db.collection('resources').get()
  const map = {}
  for (const d of snap.docs) map[d.data().name] = d.id
  return map
}

// ---------------------------------------------------------------------------
async function main() {
  // 1) Settings
  for (const s of DEFAULTS) {
    await db.doc(`system_settings/${s.key}`).set({ ...s, updated_at: FieldValue.serverTimestamp() }, { merge: true })
  }
  console.log(`✓ seeded ${DEFAULTS.length} system_settings docs`)

  // 2) Sample resources (skip if any exist)
  const existing = await db.collection('resources').limit(1).get()
  if (existing.empty) {
    for (const r of RESOURCES) {
      await db.collection('resources').add({ ...r, created_at: FieldValue.serverTimestamp() })
    }
    console.log(`✓ seeded ${RESOURCES.length} sample resources`)
  } else {
    console.log('• resources already exist — skipped')
  }

  // 3) Optional: promote an existing user to admin
  const adminEmail = arg('--admin-email')
  if (adminEmail) {
    const user = await auth.getUserByEmail(adminEmail)
    await db.doc(`profiles/${user.uid}`).set(
      { full_name: user.displayName ?? adminEmail, role: 'admin', active: true },
      { merge: true }
    )
    console.log(`✓ promoted ${adminEmail} (${user.uid}) to admin`)
  }

  // 4) Optional: demo users + sample bookings
  if (hasFlag('--demo-users')) {
    const uids = {}
    for (const du of DEMO_USERS) {
      const user = await ensureUser(du)
      await db.doc(`profiles/${user.uid}`).set(
        {
          full_name: du.full_name,
          role: du.role,
          active: true,
          created_at: FieldValue.serverTimestamp(),
        },
        { merge: true }
      )
      uids[du.role] = user.uid
      console.log(`✓ demo ${du.role} ready → ${du.email} / ${du.password}`)
    }

    // Sample bookings for the regular user (unique slot ids → idempotent)
    const resIds = await resourcesByName()
    const now = Date.now()
    for (const b of demoBookingSlots()) {
      const resourceId = resIds[b.resource]
      if (!resourceId) continue
      const slotId = `${resourceId}__${b.start.toISOString()}`
      const slotRef = db.doc(`bookings/${slotId}`)
      const exists = await slotRef.get()
      if (!exists.exists) {
        const data = {
          user_id: uids.user,
          resource_id: resourceId,
          start_time: b.start.toISOString(),
          end_time: b.end.toISOString(),
          status: b.status,
          notes: b.notes,
          created_at: now,
        }
        await slotRef.set(data)
        await db.collection('booking_history').add(data)
        console.log(`✓ demo booking: ${b.resource} — ${b.start.toLocaleString()} (${b.status})`)
      }
    }
  }

  console.log('Done.')
  process.exit(0)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
