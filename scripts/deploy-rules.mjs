#!/usr/bin/env node
/**
 * deploy-rules.mjs — deploys ./firestore.rules to the Firebase project via
 * the Rules API (no Firebase CLI login needed — uses the service account).
 *
 * Usage:
 *   node scripts/deploy-rules.mjs --service-account ~/Downloads/<key>.json [--dry-run]
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join, resolve } from 'node:path'
import { initializeApp, cert } from 'firebase-admin/app'

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
const app = initializeApp({ credential: cert(serviceAccount) })
const cred = app.options.credential
const { access_token: accessToken } = await cred.getAccessToken()
const proj = serviceAccount.project_id

const content = readFileSync(resolve(ROOT, 'firestore.rules'), 'utf8')

if (DRY_RUN) {
  console.log(`[DRY RUN] Would deploy ${content.length} chars of rules to ${proj}`)
  process.exit(0)
}

// 1. Create a new ruleset with the local source.
const rulesetRes = await fetch(`https://firebaserules.googleapis.com/v1/projects/${proj}/rulesets`, {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ source: { files: [{ name: 'firestore.rules', content }] } }),
})
const ruleset = await rulesetRes.json()
if (!ruleset.name) {
  console.error('Ruleset creation failed:', JSON.stringify(ruleset))
  process.exit(1)
}
console.log('Created ruleset:', ruleset.name)

// 2. Point the firestore release at the new ruleset.
const releaseName = `projects/${proj}/releases/cloud.firestore`
const relRes = await fetch(`https://firebaserules.googleapis.com/v1/${releaseName}`, {
  method: 'PATCH',
  headers: {
    Authorization: `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    release: { name: releaseName, rulesetName: ruleset.name },
    updateMask: 'rulesetName',
  }),
})
const release = await relRes.json()
if (!release.name) {
  console.error('Release update failed:', JSON.stringify(release))
  process.exit(1)
}
console.log('Released:', release.name, '→', release.rulesetName)
