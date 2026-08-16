/**
 * viber.ts — Viber Business (chatbot) API client.
 *
 * Sends admin notifications when a new booking is created. The credentials
 * (auth token + admin Viber user id) live in Firestore system_settings and
 * are configured from Admin → Settings → Viber notifications.
 *
 * SECURITY NOTE (important): this app is currently client-only (no backend),
 * so the Viber auth token is read by the booking flow in the browser. Anyone
 * with the app can read `system_settings` and extract the token. Acceptable
 * for a demo; for production, move the send to a backend (Firebase Cloud
 * Function or the planned ASP.NET API) and keep the token server-side.
 *
 * API reference: https://developers.viber.com/docs/api/rest-bot-api/
 */
import { collection, doc, getDoc, getDocs } from 'firebase/firestore'
import { format } from 'date-fns'

import { db } from '@/lib/firebase'

const VIBER_API = 'https://chatapi.viber.com/pa'

export interface ViberSettings {
  enabled: boolean
  token: string
  adminId: string
  senderName: string
}

/** Read Viber config from Firestore (public read — see note above). */
export async function getViberSettings(): Promise<ViberSettings> {
  const snap = await getDocs(collection(db, 'system_settings'))
  const map = new Map<string, string>()
  for (const d of snap.docs) {
    const value = d.data()?.value
    map.set(d.id, value === null || value === undefined ? '' : String(value))
  }
  return {
    enabled: map.get('viber_enabled') === 'true',
    token: map.get('viber_token') ?? '',
    adminId: map.get('viber_admin_id') ?? '',
    senderName: map.get('app_name') || 'Booking System',
  }
}

const STATUS_TEXT: Record<number, string> = {
  0: 'OK',
  1: 'Invalid URL',
  2: 'Invalid auth token',
  3: 'Bad data',
  4: 'Missing data',
  5: 'Receiver not registered with Viber',
  6: 'Receiver is not subscribed to this bot',
  7: 'Public account blocked',
  8: 'Public account not found',
  9: 'Public account suspended',
  10: 'Chat unavailable',
  11: 'Protocol error',
  12: 'Unknown error',
  13: 'Too many requests — try again later',
  14: 'Request validation failed',
  15: 'IP mismatch',
  16: 'Message expired',
  17: 'Message too long',
  18: 'Invalid API version',
  19: 'Incompatible API version',
  20: 'Bad response code',
  21: 'Receive message error',
}

function statusText(status: number): string {
  return STATUS_TEXT[status] ?? `Unknown error (${status})`
}

interface ViberApiResponse {
  status: number
  status_message?: string
  chat_hostname?: string
  id?: string
  name?: string
  uri?: string
}

/** Validate a bot token via get_account_info — returns the bot's display name. */
export async function testViberConnection(
  token: string
): Promise<{ ok: boolean; botName?: string; message: string }> {
  if (!token.trim()) return { ok: false, message: 'Enter the Viber auth token first.' }
  try {
    const res = await fetch(`${VIBER_API}/get_account_info`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Viber-Auth-Token': token.trim() },
      body: JSON.stringify({}),
    })
    const data = (await res.json()) as ViberApiResponse
    if (data.status === 0) return { ok: true, botName: data.name, message: data.status_message ?? 'Connected' }
    return { ok: false, message: `Connection failed — ${statusText(data.status)}.` }
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : 'Could not reach the Viber API.' }
  }
}

/**
 * Send a plain-text message to a Viber user.
 * The receiver must have messaged/subscribed to the bot at least once
 * (Viber privacy model — the bot cannot cold-message).
 */
export async function sendViberText(
  token: string,
  receiverId: string,
  text: string,
  senderName: string
): Promise<{ ok: boolean; message: string }> {
  if (!token.trim()) return { ok: false, message: 'Missing Viber auth token.' }
  if (!receiverId.trim()) return { ok: false, message: 'Missing admin Viber user ID.' }
  try {
    const res = await fetch(`${VIBER_API}/send_message`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Viber-Auth-Token': token.trim() },
      body: JSON.stringify({
        receiver: receiverId.trim(),
        min_api_version: 1,
        type: 'text',
        text,
        sender: { name: senderName },
      }),
    })
    const data = (await res.json()) as ViberApiResponse
    if (data.status === 0) return { ok: true, message: 'Message sent.' }
    return { ok: false, message: statusText(data.status) }
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : 'Could not send the Viber message.' }
  }
}

/** Format an ISO timestamp for the notification, e.g. "Aug 15, 2026 10:00 AM". */
function fmt(iso: string): string {
  try {
    return format(new Date(iso), 'MMM d, yyyy h:mm a')
  } catch {
    return iso
  }
}

/**
 * Notify the admin (via Viber) that a new booking was created.
 * Fire-and-forget: never throws — a Viber failure must never break the
 * booking flow. Reads resource name + booker name from Firestore.
 */
export async function notifyAdminNewBooking(info: {
  resourceId: string
  startTime: string
  endTime: string
  userId: string
}): Promise<void> {
  try {
    const cfg = await getViberSettings()
    if (!cfg.enabled || !cfg.token || !cfg.adminId) return

    const [resourceSnap, profileSnap] = await Promise.all([
      getDoc(doc(db, 'resources', info.resourceId)),
      getDoc(doc(db, 'profiles', info.userId)),
    ])
    const resourceName = resourceSnap.exists() ? String(resourceSnap.data()?.name ?? 'Resource') : 'Resource'
    const booker = profileSnap.exists() ? String(profileSnap.data()?.full_name ?? 'User') : 'User'

    const text = [
      'New booking request',
      `Resource: ${resourceName}`,
      `When: ${fmt(info.startTime)} - ${fmt(info.endTime)}`,
      `Booked by: ${booker}`,
      'Status: Pending approval',
      '',
      'Open the admin panel to confirm or cancel.',
    ].join('\n')

    await sendViberText(cfg.token, cfg.adminId, text, cfg.senderName)
  } catch (err) {
    console.error('[viber] notification failed', err instanceof Error ? err.message : err)
  }
}
