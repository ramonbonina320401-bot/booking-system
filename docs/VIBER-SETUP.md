# Viber Notifications — Setup Guide

The system sends a **Viber message to the admin** whenever a user creates a new
booking (fire-and-forget — a Viber failure never breaks the booking flow).

## What was built

| File | Purpose |
|---|---|
| `src/services/viber.ts` | Viber REST API client: `testViberConnection`, `sendViberText`, `notifyAdminNewBooking` |
| `src/components/admin/ViberSettings.tsx` | Admin settings card (toggle, token, admin ID, test, help) |
| `src/hooks/useBookings.ts` | Triggers `notifyAdminNewBooking` after a booking is created |
| `scripts/seed-firestore.mjs` | Seeds the 3 new settings keys (`viber_enabled`, `viber_token`, `viber_admin_id`) |

## How it works

1. User creates a booking → history doc written → `notifyAdminNewBooking()` runs
2. It reads Viber config from `system_settings` — if disabled or missing token/ID, it stops
3. Otherwise it joins the resource name + booker name and sends a text message via
   `POST https://chatapi.viber.com/pa/send_message`

Message format:

```
New booking request
Resource: Meeting Room A
When: Aug 15, 2026 10:00 AM - 11:00 AM
Booked by: Juan Dela Cruz
Status: Pending approval

Open the admin panel to confirm or cancel.
```

## Setup steps (admin)

### 1. Create a Viber Business Account (bot)

- Go to the Viber partner dashboard (https://partners.viber.com) and create a
  **Viber Business Account** (also called a Public Account / chatbot).
- Viber has a trial mode for testing before publishing.

### 2. Get the auth token

- In the dashboard, the bot's **auth token** is shown once the account is activated.
- Copy it — you'll paste it in **Admin → Settings → Viber notifications**.

### 3. Subscribe the admin (receiver)

- Viber bots **cannot cold-message** users. The admin must first send a message
  to the bot (or tap the subscribe prompt) so Viber registers them as a receiver.
- Have the admin open the bot in Viber and send any message like "hi".

### 4. Get the admin's Viber user ID

The user ID is a per-bot string like `7hB7x2yP9z...`. To find it:

1. In the dashboard, set a **webhook URL** for incoming messages
   (`POST /pa/set_webhook` to a public HTTPS endpoint).
2. Have the admin message the bot again.
3. Look at the webhook request body — `sender.id` is the admin's Viber user ID.
4. Paste that into **Admin Viber user ID** in Settings.

### 5. Configure + test

1. **Admin → Settings → Viber notifications**
2. Toggle **Enable Viber notifications** ON
3. Paste the **auth token** and the **admin Viber user ID**
4. Click **Test connection** — it calls `get_account_info` and shows the bot name
5. Click **Save Viber settings**

### 6. Verify

Have a user create a booking → the admin's Viber should ping within seconds.

## Common errors

| Viber status | Meaning | Fix |
|---|---|---|
| 2 | Invalid auth token | Re-copy the token from the dashboard |
| 5 | Receiver not registered | The admin hasn't used Viber / wrong user ID |
| 6 | Receiver not subscribed | The admin must message the bot first |
| 13 | Too many requests | Viber rate limit — wait and retry |
| 17 | Message too long | Message is under the limit here; unlikely |

## Security note (important)

While the app is **client-only** (no backend), the Viber token lives in
`system_settings` which every app user can read. That is acceptable for a demo,
but **not** for production. The planned fix is already documented in
`SSMS-SWAGGER-MIGRATION.md`: the send moves to a backend (Firebase Cloud
Function or the ASP.NET API), where the token stays server-side and the booking
creation triggers it via a webhook/trigger instead of the browser.
