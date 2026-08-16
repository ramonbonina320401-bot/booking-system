import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { initializeApp, cert } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

const cred = JSON.parse(readFileSync(resolve(process.argv[2]), 'utf8'))
const app = initializeApp({ credential: cert(cred) })
const db = getFirestore(app)
const vals = { booking_open_hour: 8, booking_close_hour: 18, slot_duration_minutes: 60 }
for (const [k, v] of Object.entries(vals)) {
  await db.doc(`system_settings/${k}`).set(
    { key: k, value: v, value_type: 'number', updated_at: Date.now() },
    { merge: true }
  )
}
console.log('reset hours to 8-18 / 60min')
