#!/usr/bin/env node
/**
 * check-firebase-config.mjs — validates your Firebase setup end to end.
 *
 * Reads .env (VITE_FIREBASE_*), initializes the Firebase SDK, and checks:
 *   1. Config values are present and well-formed
 *   2. Firestore is reachable and security rules allow public reads
 *   3. system_settings are seeded (prints the keys found)
 *
 * Usage:  node scripts/check-firebase-config.mjs
 */
import { readFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { initializeApp } from 'firebase/app'
import { getFirestore, collection, getDocs } from 'firebase/firestore'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

// ---- 1. Read .env ----------------------------------------------------------
function readEnv() {
  const path = join(ROOT, '.env')
  if (!existsSync(path)) return {}
  const env = {}
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '')
  }
  return env
}

const env = readEnv()
const keys = [
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_AUTH_DOMAIN',
  'VITE_FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_STORAGE_BUCKET',
  'VITE_FIREBASE_MESSAGING_SENDER_ID',
  'VITE_FIREBASE_APP_ID',
]

const missing = keys.filter((k) => !env[k])
if (missing.length > 0) {
  console.error('✗ .env is missing or incomplete. Add these keys:\n')
  for (const k of missing) console.error(`   ${k}=`)
  console.error('\n   Copy .env.example to .env and fill in the values from:')
  console.error('   Firebase console → Project settings → Your apps → your web app.')
  process.exit(1)
}
console.log('✓ .env found with all 6 VITE_FIREBASE_* keys')

// ---- 2. Initialize + verify -------------------------------------------------
const app = initializeApp({
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: env.VITE_FIREBASE_APP_ID,
})
console.log(`✓ SDK initialized for project "${env.VITE_FIREBASE_PROJECT_ID}"`)

const db = getFirestore(app)

try {
  const snap = await getDocs(collection(db, 'system_settings'))
  console.log(`✓ Firestore reachable + public read works (rules OK) — found ${snap.size} settings doc(s)`)
  if (snap.empty) {
    console.warn('\n⚠ No system_settings yet. Run the seed script:')
    console.warn('   node scripts/seed-firestore.mjs --service-account ./serviceAccountKey.json')
  } else {
    for (const d of snap.docs) {
      const v = d.data().value
      console.log(`   ${d.id} = ${typeof v === 'string' ? `"${v}"` : JSON.stringify(v)}`)
    }
  }
  process.exit(0) // close the Firestore gRPC connection explicitly
} catch (err) {
  const code = err?.code ?? ''
  console.error('\n✗ Firestore check failed:', err?.message ?? err)
  if (code === 'permission-denied') {
    console.error('\n   Likely cause: rules not deployed. Fix:')
    console.error('   Firebase console → Firestore Database → Rules → paste firebase/firestore.rules → Publish')
  } else if (code === 'not-found') {
    console.error('\n   Likely cause: Firestore database not created yet.')
    console.error('   Firebase console → Build → Firestore Database → Create database.')
  } else {
    console.error('\n   If this is an auth/network error, check your API key and project ID.')
  }
  process.exit(1)
}
