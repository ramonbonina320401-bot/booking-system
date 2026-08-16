import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { initializeApp, cert } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

const keyPath = resolve(process.argv[2])
const cred = JSON.parse(readFileSync(keyPath, 'utf8'))
const app = initializeApp({ credential: cert(cred) })
const db = getFirestore(app)
const snap = await db.collection('system_settings').get()
const out = {}
snap.forEach((d) => {
  out[d.id] = { value: d.data().value, type: d.data().value_type }
})
console.log(JSON.stringify(out, null, 1))
