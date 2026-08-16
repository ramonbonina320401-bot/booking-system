#!/usr/bin/env node
/**
 * backfill-emails.mjs — copies each Firebase Auth user's email onto their
 * `profiles/{uid}` doc so the client-only Admin Users page can list it.
 * (Auth emails are not readable client-side; profiles are.)
 *
 * Usage:
 *   node scripts/backfill-emails.mjs --service-account ~/Downloads/<key>.json [--dry-run]
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
const auth = getAuth()

// ── 1. List every Auth user (paginate through all pages) ──────────────────
const emails = new Map() // uid -> email ('' for phone-only accounts)
let nextPageToken
let listed = 0
do {
  const page = await auth.listUsers(1000, nextPageToken)
  for (const u of page.users) {
    emails.set(u.uid, u.email ?? '')
    listed++
  }
  nextPageToken = page.pageToken
} while (nextPageToken)
console.log(`Auth users listed: ${listed}${DRY_RUN ? '   [DRY RUN — no changes]' : ''}\n`)

// ── 2. For each Auth user, write email onto the profile doc (if it differs) ─
let updated = 0
let skipped = 0
for (const [uid, email] of emails) {
  const ref = db.collection('profiles').doc(uid)
  const snap = await ref.get()
  if (!snap.exists) {
    skipped++ // no profile doc — nothing to sync
    continue
  }
  const current = snap.data()?.email ?? ''
  if (current === email) {
    skipped++
    continue
  }
  if (DRY_RUN) {
    console.log(`  would update ${uid}: '${current}' -> '${email}'`)
    updated++
    continue
  }
  await ref.update({ email })
  console.log(`  updated ${uid}: '${current}' -> '${email}'`)
  updated++
}

console.log(`\nDone. ${updated} profile(s) ${DRY_RUN ? 'would be ' : ''}updated, ${skipped} already in sync.`)
