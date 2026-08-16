# Booking System — Dynamic Branding + Maintenance Mode + PWA (Firebase)

Full-stack booking system where **branding and maintenance mode are configured
from the database** — no code changes, no redeploys. Installable as a PWA on
mobile from the same codebase as the web app.

> **Backend:** Firebase (Firestore, Auth, Security Rules).
> Originally built against Supabase; migrated because the Supabase free-tier
> quota was reached. Firebase Cloud Storage requires the paid Blaze plan
> (since Oct 1, 2025), so logos are stored as **base64 inside Firestore** —
> the whole app runs on the free Spark plan, no billing card needed.

| Layer | Stack |
|---|---|
| Frontend | React 18 · Vite 6 · TypeScript · Tailwind CSS 4 (CSS custom properties) |
| Routing | React Router 7 |
| UI | shadcn/ui-style components (Radix primitives) · bento-grid dashboard styling |
| Server state | TanStack Query (React Query) |
| Client state | Zustand (booking flow, UI, theme) + React Context (settings broadcast) |
| Backend | Firebase (Firestore, Auth, Security Rules) |
| Mobile | PWA (`vite-plugin-pwa`, web manifest, service worker) |
| Package manager | pnpm |
| Deploy | Vercel (frontend) + Firebase (hosted backend) |

---

## 1. Setup Instructions

### Prerequisites
- Node.js 18+ (tested on 22)
- pnpm 9+ (tested on 11)
- A Firebase project — **free Spark plan is enough** (no billing card required)

### Step 1 — Install dependencies
```bash
cd booking-system
pnpm install
```

### Step 2 — Configure Firebase in the console (once, ~5 min)
1. Go to [Firebase console](https://console.firebase.google.com/) → **Add project**
2. **Build → Authentication → Sign-in method → Email/Password → Enable**
3. **Build → Firestore Database → Create database** (production mode; e.g. `asia-southeast1`)
4. **⚙️ Project settings → Your apps → Web app** to register the app and get the config object
   - Skip **Storage** — this app stores its logo in Firestore, not Cloud Storage.

### Step 3 — Configure environment
```bash
cp .env.example .env
```
Fill in the six `VITE_FIREBASE_*` values from the Firebase config object:
```
VITE_FIREBASE_API_KEY=AIza...
VITE_FIREBASE_AUTH_DOMAIN=your-app.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project
VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=1234567890
VITE_FIREBASE_APP_ID=1:1234567890:web:abcdef
```
> ⚠️ Never commit `.env`. Only `.env.example` is committed.

### Step 4 — Deploy security rules
```bash
firebase login
firebase init                       # choose Firestore, accept defaults
firebase deploy --only firestore:rules
```
> Manual alternative: paste `firebase/firestore.rules` into Console →
> Firestore → Rules, then create the two composite indexes from
> `firebase/firestore.indexes.json` (Console → Firestore → Indexes).

### Step 5 — Seed defaults (settings + sample resources)
Get a service account key (Console → Project settings → **Service accounts** →
Generate new private key), then run the idempotent seed script:
```bash
node scripts/seed-firestore.mjs --service-account ./serviceAccountKey.json
```
This writes the 9 `system_settings` docs (native types: booleans/numbers) and
3 sample resources.

### Step 6 — Bootstrap your admin account
1. Run the app: `pnpm dev`
2. Sign up with your email at `/login`
3. Promote yourself with the seed script:
```bash
node scripts/seed-firestore.mjs \
  --service-account ./serviceAccountKey.json \
  --admin-email you@example.com
```
4. Refresh — `/admin` is now unlocked.

### Step 7 — Run / build
```bash
pnpm dev        # local dev server
pnpm build      # typecheck + production build (generates the service worker)
pnpm preview    # serve the production build locally
```

---

## 2. Folder Structure

```
booking-system/
├── public/
│   ├── manifest.json            # static PWA manifest (default branding)
│   ├── offline.html             # offline fallback page
│   ├── icons/                   # 192 / 512 / maskable / apple-touch PNGs
│   └── favicon.svg
├── src/
│   ├── main.tsx                 # entry: providers + router + toaster
│   ├── App.tsx                  # root component
│   ├── lib/
│   │   ├── firebase.ts          # ★ Firebase client init (auth, db)
│   │   ├── queryClient.ts       # TanStack Query client
│   │   ├── color.ts             # contrast/hex helpers (dynamic theming)
│   │   ├── timeSlots.ts         # 1-hour slot availability math
│   │   ├── storage.ts           # logo validation + base64 reader (no paid Storage)
│   │   ├── pwa.ts               # dynamic manifest injection
│   │   └── utils.ts             # cn() class merge
│   ├── types/                   # booking / settings / user types
│   ├── contexts/
│   │   └── SettingsContext.tsx  # ★ dynamic branding engine (DB → CSS vars)
│   ├── stores/
│   │   ├── useBookingFlowStore.ts  # multi-step booking wizard state
│   │   ├── useThemeStore.ts        # light/dark/system theme (localStorage)
│   │   └── useUIStore.ts           # sidebar / mobile nav state
│   ├── hooks/
│   │   ├── useSettings.ts
│   │   ├── useAuth.ts           # Firebase Auth + Firestore profile/role
│   │   ├── useBookings.ts       # atomic slot docs + history + Query hooks
│   │   ├── useResources.ts
│   │   └── useMaintenanceGuard.ts # frontend maintenance check
│   ├── components/
│   │   ├── ui/                  # button, card (bento), dialog, select, ...
│   │   ├── layout/              # Navbar, Sidebar, Brand, ThemeToggle, ...
│   │   ├── booking/             # BookingCalendar, BookingForm, Card, List
│   │   └── admin/               # SettingsPanel, LogoUploader, ColorPicker,
│   │                            # MaintenanceToggle, ResourceManager, BookingManager
│   ├── pages/                   # Home, Login, Booking, MyBookings, admin/*
│   ├── routes/
│   │   └── AppRouter.tsx        # routes + RequireAuth / RequireAdmin / AppGate
│   └── styles/globals.css       # Tailwind 4 + CSS-var fallbacks + .dark theme
├── firebase/
│   ├── firestore.rules          # ★ security rules (replaces RLS)
│   └── firestore.indexes.json   # composite indexes
├── scripts/
│   ├── generate-icons.mjs       # zero-dependency PNG icon generator
│   ├── seed-firestore.mjs       # Admin-SDK seed (settings, resources, admin)
│   └── check-firebase-config.mjs# validates .env + Firestore + rules + seed
├── vite.config.ts               # PWA + manualChunks config
└── .env.example
```

---

## 3. How Dynamic Branding Works

Everything you can brand lives in the `system_settings` collection
(doc id = key, values stored with **native types**):

| key | type | used for |
|---|---|---|
| `app_name` | string | navbar/title text |
| `logo_url` | string | `<img>` in the navbar — a **base64 data URL** stored in Firestore (no paid Storage needed) |
| `logo_width` / `logo_height` | number | rendered logo dimensions (clamped 40–300px) |
| `primary_color` | string | buttons, active nav, links, calendar accents |
| `background_color` | string | page/app background (light mode) |
| `accent_color` | string | highlights, warnings, maintenance icon |

### Data flow
```
Firestore system_settings/{key}
      │  TanStack Query — fetch once + cache (staleTime: Infinity)
      ▼
SettingsContext
      │  writes CSS custom properties on <html>:
      │    --app-primary / --app-accent / --app-background (+ computed
      │    readable foregrounds for contrast), and refreshes the PWA
      │    manifest + theme-color meta
      ▼
Tailwind utilities (bg-primary, text-accent, ...) re-style instantly
      ▼
UI (navbar logo <img width/height>, buttons, cards, calendar, install screen)
```

**Why Tailwind 4 (instead of a `tailwind.config.ts`):** with `@theme inline`
in `globals.css`, every utility like `bg-primary` compiles to
`background-color: var(--app-primary)`. Changing the variable at runtime
re-styles the whole app — no build step, no reload. Sensible fallback values
are baked into `:root` so there is no flash of unstyled content before the
settings load.

**Editing branding (admin only):**
1. Go to **/admin/settings**
2. Upload a logo (PNG/JPG/SVG/WEBP, ≤ 500 KB — it is stored as base64 in
   Firestore, under the 1 MiB per-document limit), adjust width/height —
   preview updates live
3. Pick colors with the color pickers — they apply live as a preview
4. Press **Save all settings** → docs upsert to `system_settings` → the
   settings query invalidates → the context re-applies branding from Firestore

---

## 4. How Maintenance Mode Works

There are **two enforcement layers** — the frontend cannot be bypassed by
tampering with browser state.

### Layer 1 — Frontend (`useMaintenanceGuard` + `AppGate`)
- `SettingsContext` exposes `maintenance_mode` (a native boolean from Firestore).
- `AppGate` wraps **every route** in `AppRouter.tsx`. When maintenance is on
  and the current user's role is **not** `admin`, they see `MaintenanceScreen`
  with the custom `maintenance_message` — nothing else renders.
- Admins are never blocked, so they can always log in and turn it off.

### Layer 2 — Backend (Firestore security rules)
- The rules read `system_settings/maintenance_mode` and **deny `create` on
  `bookings` and `booking_history` while it is `true`** — see the
  `maintenanceOn()` function in `firebase/firestore.rules`.
- So even a crafted client cannot create a booking during maintenance.

### How to toggle
1. Sign in as admin → **/admin/settings**
2. Flip **Maintenance mode** on/off (optional: edit the message)
3. **Save all settings** — it persists `maintenance_mode` + `maintenance_message`
4. Regular users instantly see the maintenance screen; you still have full access

---

## 5. Booking Logic (anti-double-booking)

Firestore has no `EXCLUDE` constraint, so we use the standard atomic pattern:

**Two collections:**

1. **`bookings/{resourceId}__{startISO}`** — the *slot occupancy* doc.
   The document id is derived from resource + slot start, so two users racing
   for the same slot **write the same doc**. `setDoc(..., { merge: false })`
   is atomic: exactly one writer wins, the other gets an `already-exists`
   error which the UI surfaces as "That slot was just taken."

2. **`booking_history/{autoId}`** — the *permanent record* with the status
   lifecycle (`pending → confirmed → completed` / `cancelled`). Lists and the
   admin manager read from here. **Cancelling** updates the history doc and
   **deletes the slot doc** — the slot frees up for rebooking while the
   history (and the cancelled status) is preserved.

- The UI layers on top: `BookingCalendar` disables fully-booked days and shows
  free 1-hour slots (8 AM – 5 PM), and the create mutation invalidates the
  bookings queries on success so availability refreshes automatically.

---

## 6. PWA (mobile app)

- **Installable:** `vite-plugin-pwa` generates a service worker + precaches
  static assets; the web manifest + 192/512/maskable/apple-touch icons make it
  installable from the phone's browser ("Add to Home Screen").
- **Dynamic install screen:** `src/lib/pwa.ts` rebuilds the manifest from
  `system_settings` (app name, theme color, background color) into a Blob URL
  and swaps it in — so the install dialog matches your brand. `theme-color`
  meta stays in sync too.
- **Offline behavior:** cache-first for static assets, with `offline.html` as
  a navigation fallback. Firestore/Auth traffic is never cached. Booking
  requires live data, so offline is intentionally limited to static pages.

---

## 7. Auth & Roles

- Firebase Auth (email/password). The role lives in the **`profiles/{uid}`**
  doc (`admin` / `user`), not in custom claims, so security rules can query it
  via `get(...)` in `isAdmin()`.
- `AppRouter.tsx` guards:
  - `RequireAuth` — redirects to `/login` (preserving the intended URL)
  - `RequireAdmin` — non-admins are sent home
  - `AppGate` — maintenance screen for non-admins
- Security rules summary (`firebase/firestore.rules`):

| collection | read | write |
|---|---|---|
| `system_settings` | public (anyone) | admin only |
| `resources` | public | admin only |
| `bookings` (slot docs) | owner / admin | create own (maintenance off, resource active) · owner can cancel own slot · admin all |
| `booking_history` | owner / admin | create own (maintenance off) · owner can cancel own · delete admin |
| `profiles` | owner / admin | create own · update own / admin · delete admin |

---

## 8. Known Limitations

- **Logo is stored as base64 in Firestore** (max 500 KB) because Firebase
  Cloud Storage requires the paid Blaze plan (Oct 2025 change). If you upgrade
  to Blaze later, swap `uploadLogo()` in `src/lib/storage.ts` for a
  `getDownloadURL()` implementation — one file.
- **PWA manifest isn't 100% dynamic.** A static `manifest.json` ships in the
  build; the dynamic version is injected client-side after settings load, so
  the *first* install prompt (before JS runs) shows the default brand.
- **Offline mode is static-only.** No offline booking — bookings need live
  data and Firestore is the source of truth.
- **Slots are fixed 1-hour windows** (8 AM–5 PM) via `SLOT_HOURS` in
  `src/lib/timeSlots.ts`. Custom durations/working hours would need a small
  extension.
- **PWA icons are generated placeholders** (script-generated calendar mark).
  Replace `public/icons/*.png` with real brand artwork when available.
- **Bundle size:** the Firebase SDK pushes the main chunk to ~995 KB. Lazy
  loading / code-splitting Firebase is a worthwhile follow-up.
- **No automated tests yet** — the build/typecheck is green; unit tests for
  slot math + rule verification are a recommended next step.
- The `cancel → slot free → rebook` flow relies on the client deleting the
  slot doc; a user could theoretically skip the delete (their slot then stays
  "occupied"). Low risk for an internal tool; a Cloud Function can make it
  airtight.

## 9. Future Improvements

- **Real native mobile app:** the PWA covers "mobile app" today; for App
  Store/Play Store distribution, extract the shared logic (hooks, stores, lib)
  into a monorepo package and build an **Expo (React Native)** client against
  the same Firebase backend — rules and schema are client-agnostic.
- **Cloud Functions** for airtight maintenance + cancel flows (server-side
  slot freeing), email notifications, and (if you upgrade to Blaze) real
  Storage-backed logo uploads.
- **Availability calendars with custom durations** and recurring bookings.
- **Google OAuth** sign-in (one toggle in the Firebase console).
- **Audit log** for settings changes (who changed the brand, when).
- **Multi-tenancy**: add `org_id` fields + rules scoping if you want to resell
  this as a product.

---

## Checklist (deliverable verification)

- [x] All branding (logo, colors, sizes, name) comes from the database — no hardcoded values in components
- [x] Admin panel: logo upload, color changes, maintenance toggle
- [x] Colors apply live (CSS variables, no reload/redeploy)
- [x] Maintenance blocks regular users on the frontend AND backend (security rules)
- [x] No double-booking — atomic slot docs (deterministic Firestore doc id)
- [x] PWA installable (manifest, service worker, icons, dynamic manifest refresh)
- [x] Security rules correct (admin vs user)
- [x] `.env.example` provided, no secrets committed
- [x] Runs entirely on the free Spark plan — no billing card required
