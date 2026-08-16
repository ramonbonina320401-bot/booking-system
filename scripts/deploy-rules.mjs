/**
 * deploy-rules.mjs — deploy firestore.rules WITHOUT logging into the Firebase
 * CLI, using the service account key (admin credentials → REST API).
 *
 * Usage:
 *   node scripts/deploy-rules.mjs --service-account <path-to-key.json>
 *
 * (Optional) --project overrides the project id from the key's project_id.
 */
import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { createSign } from 'node:crypto'

const ROOT = resolve(import.meta.dirname, '..')

const args = process.argv.slice(2)
const serviceAccountArg = args.find((a) => a.startsWith('--service-account='))?.split('=')[1]
const projectArg = args.find((a) => a.startsWith('--project='))?.split('=')[1]

if (!serviceAccountArg) {
  console.error('Usage: node scripts/deploy-rules.mjs --service-account ./serviceAccountKey.json')
  process.exit(1)
}

// Accept absolute paths, `./`-relative, or bare filenames (resolved to ROOT).
const keyPath = serviceAccountArg.includes('/') || serviceAccountArg.includes('\\')
  ? serviceAccountArg
  : join(ROOT, serviceAccountArg.replace(/^\.\//, ''))
const serviceAccount = JSON.parse(readFileSync(keyPath, 'utf8'))
const projectId = projectArg || serviceAccount.project_id

const RULES_FILE = join(ROOT, 'firestore.rules')

// ---------------------------------------------------------------------------
// 1. Mint a short-lived access token from the service account (JWT grant).
// ---------------------------------------------------------------------------
const now = Math.floor(Date.now() / 1000)
const header = { alg: 'RS256', typ: 'JWT' }
const claims = {
  iss: serviceAccount.client_email,
  scope: 'https://www.googleapis.com/auth/firebase',
  aud: 'https://oauth2.googleapis.com/token',
  iat: now,
  exp: now + 3600,
}
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url')
const unsigned = `${b64(header)}.${b64(claims)}`
const sign = createSign('RSA-SHA256')
sign.update(unsigned)
const signature = sign.sign(serviceAccount.private_key, 'base64url')
const jwt = `${unsigned}.${signature}`

const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({
    grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
    assertion: jwt,
  }),
})
const tokenData = await tokenRes.json()
if (!tokenData.access_token) {
  console.error('Token exchange failed:', JSON.stringify(tokenData).slice(0, 300))
  process.exit(1)
}
const accessToken = tokenData.access_token

// ---------------------------------------------------------------------------
// 2. Upload the rules file as a new Ruleset.
// ---------------------------------------------------------------------------
const rulesSource = readFileSync(RULES_FILE, 'utf8')
const rulesetRes = await fetch(
  `https://firebaserules.googleapis.com/v1/projects/${projectId}/rulesets`,
  {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ source: { files: [{ name: 'firestore.rules', content: rulesSource }] } }),
  }
)
const ruleset = await rulesetRes.json()
if (!ruleset.name) {
  console.error('Ruleset upload failed:', JSON.stringify(ruleset).slice(0, 300))
  process.exit(1)
}
console.log('Ruleset uploaded:', ruleset.name)

// ---------------------------------------------------------------------------
// 3. Release it to the default Firestore ruleset (live).
// ---------------------------------------------------------------------------
// Matches firebase-tools' updateOrCreateRelease: try PATCH (update); if the
// release doesn't exist yet (404), POST to create it. The Release resource is
// wrapped in a `release` field on the PATCH body.
const RELEASE_ID = 'cloud.firestore' // Firestore's release id (NOT firestore.cloud.firestore)
const releaseName = `projects/${projectId}/releases/${RELEASE_ID}`
const releasePayload = JSON.stringify({
  release: { name: releaseName, rulesetName: ruleset.name },
})

let release = null
const patchRes = await fetch(
  `https://firebaserules.googleapis.com/v1/${releaseName}`,
  {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: releasePayload,
  }
)
if (patchRes.ok) {
  release = await patchRes.json()
} else {
  // 404 = release not created yet → POST /releases to create it.
  const createRes = await fetch(
    `https://firebaserules.googleapis.com/v1/projects/${projectId}/releases`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: releaseName, rulesetName: ruleset.name }),
    }
  )
  if (!createRes.ok) {
    const err = await createRes.json()
    console.error('Release create failed:', JSON.stringify(err).slice(0, 300))
    process.exit(1)
  }
  release = await createRes.json()
}

console.log('✅ Rules LIVE →', release.name)
console.log(`   Ruleset: ${ruleset.name} (${rulesSource.length} bytes)`)
