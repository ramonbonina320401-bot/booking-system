#!/usr/bin/env node
/**
 * clean-test-data.mjs — removes e2e/demo bookings and resets future
 * bookings that were wrongly marked "completed" back to "pending".
 *
 * Usage:
 *   node scripts/clean-test-data.mjs --service-account ~/Downloads/<key>.json [--dry-run]
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join, resolve } from 'node:path'
import { initializeApp, cert } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

const args = process.argv.slice(2)
const arg = (name) => {
  const i = args.indexOf(name)
  return i >= 0 ? args[i + 1] : undefined
}
const DRY_RUN = args.includes('--dry-run')

const serviceAccountPath = arg('--service-account')
if (!serviceAccountPath) {
  console.error('Missing --service-account <path-to-serviceAccountKey.json>')
  process.exit(1)
}

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const serviceAccount = JSON.parse(readFileSync(resolve(ROOT, serviceAccountPath), 'utf8'))
initializeApp({ credential: cert(serviceAccount) })
const db = getFirestore()

const now = Date.now()
console.log(`now = ${new Date().toISOString()}${DRY_RUN ? '   [DRY RUN — no changes]' : ''}\n`)

// ── 1. Delete e2e/demo bookings ────────────────────────────────────────────
const history = await db.collection('booking_history').get()
const toDelete = []
for (const d of history.docs) {
  const b = d.data()
  const notes = String(b.notes ?? '').toLowerCase()
  if (notes.includes('e2e test') || notes.includes('demo data')) {
    toDelete.push({ historyId: d.id, resourceId: b.resource_id, start: b.start_time, notes: b.notes })
  }
}

// ── 2. Reset future bookings wrongly marked completed ─────────────────────
const toReset = []
for (const d of history.docs) {
  const b = d.data()
  const start = new Date(b.start_time)
  if (start.getTime() > now && b.status === 'completed') {
    toReset.push({ historyId: d.id, resourceId: b.resource_id, start: b.start_time })
  }
}

// ── Apply ──────────────────────────────────────────────────────────────────
let delCount = 0
for (const b of toDelete) {
  const slotId = `${b.resourceId}__${b.start}`
  if (DRY_RUN) {
    console.log(`  DELETE history ${b.historyId} (${b.start}) notes="${b.notes}"`)
    console.log(`  DELETE slot   ${slotId}`)
    delCount += 1
    continue
  }
  await db.collection('booking_history').doc(b.historyId).delete()
  const slotRef = db.collection('bookings').doc(slotId)
  const slotDoc = await slotRef.get()
  if (slotDoc.exists) {
    await slotRef.delete()
    console.log(`  DELETED history ${b.historyId} + slot ${slotId}`)
  } else {
    console.log(`  DELETED history ${b.historyId} (no slot doc)`)
  }
  delCount += 1
}

let resetCount = 0
for (const b of toReset) {
  if (DRY_RUN) {
    console.log(`  RESET  history ${b.historyId} (${b.start}) completed → pending`)
    resetCount += 1
    continue
  }
  await db.collection('booking_history').doc(b.historyId).update({ status: 'pending' })
  console.log(`  RESET  history ${b.historyId} (${b.start}) → pending`)
  resetCount += 1
}

console.log(`\n${DRY_RUN ? 'Would delete' : 'Deleted'} ${delCount} demo/e2e booking(s), ${DRY_RUN ? 'would reset' : 'reset'} ${resetCount} future+completed booking(s).`)
