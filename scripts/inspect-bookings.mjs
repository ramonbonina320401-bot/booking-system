#!/usr/bin/env node
/**
 * inspect-bookings.mjs — lists every booking + profile so we can decide what
 * is real data vs test/demo data BEFORE cleaning anything.
 *
 * Usage:
 *   node scripts/inspect-bookings.mjs --service-account ~/Downloads/<key>.json
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join, resolve } from 'node:path'
import { initializeApp, cert } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { getAuth } from 'firebase-admin/auth'

const args = process.argv.slice(2)
const arg = (name) => {
  const i = args.indexOf(name)
  return i >= 0 ? args[i + 1] : undefined
}

const serviceAccountPath = arg('--service-account')
if (!serviceAccountPath) {
  console.error('Missing --service-account <path-to-serviceAccountKey.json>')
  process.exit(1)
}

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const serviceAccount = JSON.parse(readFileSync(resolve(ROOT, serviceAccountPath), 'utf8'))
initializeApp({ credential: cert(serviceAccount) })
const db = getFirestore()
const auth = getAuth()

const now = Date.now()
const nowISO = new Date().toISOString()

// ── Profiles ────────────────────────────────────────────────────────────────
const profiles = await db.collection('profiles').get()
console.log(`\n===== PROFILES (${profiles.size}) =====`)
for (const d of profiles.docs) {
  const p = d.data()
  console.log(`  ${d.id}  name="${p.full_name ?? ''}"  role=${p.role ?? '?'}  phone=${p.phone ?? ''}  created=${p.created_at ?? ''}`)
}

// ── Bookings ────────────────────────────────────────────────────────────────
const bookings = await db.collection('booking_history').get()
console.log(`\n===== BOOKING HISTORY (${bookings.size}) =====`)
const rows = bookings.docs.map((d) => ({ id: d.id, ...d.data() }))
rows.sort((a, b) => String(a.start_time).localeCompare(String(b.start_time)))

for (const b of rows) {
  const start = new Date(b.start_time)
  const future = start.getTime() > now
  const upcomingCompleted = future && b.status === 'completed'
  const flag = upcomingCompleted ? '  ⚠️ FUTURE+COMPLETED' : ''
  console.log(
    `  ${b.start_time}  →  ${b.end_time}  |  res=${b.resource_id ?? ''}  user=${b.user_id ?? ''}  status=${b.status ?? '?'}  notes="${b.notes ?? ''}"${flag}`
  )
}

// ── Slots (occupancy docs) ──────────────────────────────────────────────────
const slots = await db.collection('bookings').get()
console.log(`\n===== SLOT OCCUPANCY (${slots.size}) =====`)
for (const d of slots.docs) {
  const s = d.data()
  console.log(`  ${d.id}  status=${s.status ?? '?'}  user=${s.user_id ?? ''}  start=${s.start_time ?? ''}`)
}

// ── Users (auth) ────────────────────────────────────────────────────────────
try {
  const list = await auth.listUsers(50)
  console.log(`\n===== AUTH USERS (${list.users.length}) =====`)
  for (const u of list.users) {
    console.log(`  ${u.uid}  email=${u.email ?? ''}  phone=${u.phoneNumber ?? ''}  created=${u.metadata.creationTime ?? ''}`)
  }
} catch (e) {
  console.log(`\n(auth list failed: ${e.message})`)
}

console.log(`\nnow = ${nowISO}`)
