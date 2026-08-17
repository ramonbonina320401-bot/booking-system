# SSMS + Swagger — Migration & API Plan

> **Status: PLAN COMPLETE (Aug 17, 2026)** — the ASP.NET Core Web API skeleton
> lives in [`api/`](../api/) with Swagger UI, EF Core (InMemory for demo, SQL
> Server via connection string), and the core endpoints implemented.
>
> **👉 Para sa kumpletong migration plan (feature inventory, gaps, endpoint list,
> security, data migration, frontend switch, testing, deployment, rollback,
> timeline, definition-of-done): basahin ang [`SSMS-MIGRATION-PLAN.md`](SSMS-MIGRATION-PLAN.md).**
> Ang file na ito ay ang technical reference (data model, schema, endpoint mapping).
> **Last updated: Aug 17, 2026.**

---

## 1. Why the plan exists

The client confirmed the database will eventually move from **Firebase (Firestore)**
to **SQL Server (SSMS)**, and asked for a **Swagger API**. The current stack stays
until all frontend + backend features are done — then we migrate together.

**Current stack (today):** React PWA (Vite) → Firebase Auth + Firestore. There is
**no server**: all business logic runs client-side, and the Firestore **security
rules** are the only server-side enforcement.

---

## 2. Target architecture

```
[React PWA frontend]  →  [REST API (ASP.NET Core)]  →  [SQL Server (SSMS)]
                             │
                             └─ Swagger UI (/swagger) for API docs & testing
```

- **Backend:** ASP.NET Core Web API (C#) — the standard pairing with SSMS.
- **Swagger:** built in via Swashbuckle — auto-generated docs + interactive "Try it out".
- **Database:** SQL Server (local SSMS first, then host — Azure SQL free tier or VPS).
- **Frontend:** unchanged UI — only the data layer swaps (`firebase/firestore` calls → `fetch` to the API).

---

## 3. Current Firestore data model (authoritative)

> This is the **actual live model** — keep this table in sync whenever the app's
> collections/fields change.

### Collections

| Collection | Doc ID | Purpose |
|---|---|---|
| `profiles/{uid}` | Firebase UID | User profile + role + active flag |
| `resources/{id}` | auto | Bookable resources |
| `bookings/{resourceId}__{startISO}` | deterministic | **Slot occupancy** — the atomic anti-double-booking conflict point |
| `booking_history/{autoId}` | auto | **Permanent** booking records (status lifecycle) |
| `system_settings/{key}` | key name | Branding, maintenance, booking hours, Viber config |
| `announcements/{id}` | auto | Notices + scheduled closures |
| `audit_log/{id}` | auto | **Immutable** record of admin actions (added Aug 16, 2026) |

### Field-by-field

**`profiles/{uid}`**
| Field | Type | Notes |
|---|---|---|
| `full_name` | string | ≤ 100 chars (rules) |
| `role` | `'admin' \| 'user'` | **Admin-only** to change (rules) |
| `email` | string \| null | Copied from Auth so client pages can list it |
| `phone` | string \| null | Contact phone (shown to admins) |
| `active` | boolean | **Deactivated users cannot book** — enforced in rules |
| `avatar_url` | string \| null | base64 data URL (free-plan logo/avatar path) |
| `fcm_token` | string \| null | Push token |
| `created_at` / `updated_at` | number | epoch ms |

**`resources/{id}`** — `name` (≤100), `description` (≤1000), `is_active` (bool), `created_at`.

**`bookings/{resourceId}__{startISO}`** (slot) **and** `booking_history/{id}` (history) — same fields:
| Field | Type | Notes |
|---|---|---|
| `user_id` | string | FK → profiles |
| `resource_id` | string | FK → resources |
| `start_time` | string | ISO-8601 UTC (`2026-08-17T02:00:00.000Z`) |
| `start_ms` | number | **epoch ms mirror of start_time** — lets rules reject past dates (added Aug 16, 2026) |
| `end_time` | string | ISO-8601 UTC |
| `status` | `'pending' \| 'confirmed' \| 'cancelled' \| 'completed'` | Creates are **forced to `'pending'`** by rules — approval cannot be forged |
| `notes` | string \| null | ≤ 500 chars (rules) |
| `created_at` | number | epoch ms |

**`system_settings/{key}`** — `key`, `value` (native: string/bool/number/number[]), `value_type` (`string|color|boolean|number|image|days`), `updated_by`, `updated_at`.
Keys: `maintenance_mode`, `maintenance_message`, `logo_url`, `logo_width`, `logo_height`, `primary_color`, `background_color`, `accent_color`, `app_name`, `viber_enabled`, `viber_token`, `viber_admin_id`, `booking_open_hour`, `booking_close_hour`, `slot_duration_minutes`, `booking_closed_days`.

**`announcements/{id}`** — `title` (≤100), `body` (≤2000), `kind` (`notice|closure`), `start_date`/`end_date` (`YYYY-MM-DD`), `created_at`, `created_by`.

**`audit_log/{id}`** — `action`, `target_type`, `target_id`, `details`, `actor_uid`, `actor_name`, `created_at`. Append-only (no update/delete in rules).

### Firebase Auth (identity layer — stays)

Users have: `email` (nullable), `emailVerified`, `phoneNumber` (nullable), `displayName`, and one or more providers (`email`, `google`, `facebook`, `phone`).

---

## 4. Firestore rules → API enforcement mapping

Every rule the current system enforces must be replicated server-side in the API.
This table is the **requirements checklist** for the backend.

| Firestore rule (today) | API equivalent (tomorrow) |
|---|---|
| `isSignedIn()` | `[Authorize]` + Firebase ID-token validation |
| `isAdmin()` (role from profile doc) | `Users.Role == "admin"` claim/check per request |
| `isActiveUser()` — deactivated users blocked | Check `Users.IsActive` on every booking write |
| `emailVerifiedOrPhone()` — unverified email blocked from booking | `Email IS NULL OR EmailVerified = 1` before create |
| `!maintenanceOn()` | Reject booking create when `Settings['maintenance_mode'] = true` |
| `startsInFuture()` (`start_ms > now`) | Validate `StartTime > SYSUTCDATETIME()` |
| `status == 'pending'` on create | **API always sets** status to `pending` — never accept client status |
| `strLenOk(...)` input caps | `[MaxLength]` data annotations / DTO validation |
| own-doc read scoping | `WHERE UserId = @currentUser` on every user-scoped query |
| role/active are admin-only on profile update | API ignores client-supplied `Role`/`IsActive` in profile updates |
| owner cancel only (`pending/confirmed → cancelled`) | Ownership check + allowed status transitions |
| `audit_log` admin-only, immutable | API writes `AuditLog` rows server-side (never client) |
| atomic slot (deterministic doc id + `merge:false`) | `UNIQUE (ResourceId, StartTime)` constraint + try/catch on insert |

---

## 5. SQL Server schema (SSMS)

Design decisions:
- `Users.Id` = **Firebase UID** (`NVARCHAR(128)`) — the ID token maps directly, no lookup needed.
- `Bookings.Id` = Firestore `booking_history` autoId (GUID).
- The slot doc (`bookings/`) collapses into `Bookings` via the **UNIQUE (ResourceId, StartTime)** constraint.
- `Settings.Value` stored as string; the API casts by `ValueType` (same logic as `SettingsContext.parseValue`).

```sql
-- ===========================================================================
-- Booking System — SQL Server schema (migration target)
-- Run in SSMS against a fresh database.
-- ===========================================================================

CREATE TABLE Users (
    Id             NVARCHAR(128)  PRIMARY KEY,          -- Firebase UID
    FullName       NVARCHAR(100)  NOT NULL,
    Email          NVARCHAR(254)  NULL,
    EmailVerified  BIT            NOT NULL DEFAULT 0,
    Phone          NVARCHAR(30)   NULL,
    Role           NVARCHAR(10)   NOT NULL DEFAULT 'user'
                   CHECK (Role IN ('admin','user')),
    IsActive       BIT            NOT NULL DEFAULT 1,
    AvatarUrl      NVARCHAR(MAX)  NULL,                 -- base64 data URL (legacy)
    FcmToken       NVARCHAR(500)  NULL,
    SignInProvider NVARCHAR(20)   NULL,                 -- email|google|facebook|phone
    CreatedAt      DATETIME2      NOT NULL DEFAULT SYSUTCDATETIME(),
    UpdatedAt      DATETIME2      NULL
);

CREATE TABLE Resources (
    Id          UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    Name        NVARCHAR(100)  NOT NULL,
    Description NVARCHAR(1000) NULL,
    IsActive    BIT            NOT NULL DEFAULT 1,
    CreatedAt   DATETIME2      NOT NULL DEFAULT SYSUTCDATETIME()
);

CREATE TABLE Bookings (
    Id         UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    UserId     NVARCHAR(128)  NOT NULL REFERENCES Users(Id),
    ResourceId UNIQUEIDENTIFIER NOT NULL REFERENCES Resources(Id),
    StartTime  DATETIME2      NOT NULL,
    EndTime    DATETIME2      NOT NULL,
    Status     NVARCHAR(20)   NOT NULL DEFAULT 'pending'
               CHECK (Status IN ('pending','confirmed','cancelled','completed')),
    Notes      NVARCHAR(500)  NULL,
    CreatedAt  DATETIME2      NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT UQ_Bookings_Slot UNIQUE (ResourceId, StartTime)  -- anti-double-booking
);
CREATE INDEX IX_Bookings_UserId    ON Bookings (UserId);
CREATE INDEX IX_Bookings_StartTime ON Bookings (StartTime);

CREATE TABLE Settings (
    [Key]     NVARCHAR(50) PRIMARY KEY,
    Value     NVARCHAR(MAX) NULL,          -- cast by ValueType at the API
    ValueType NVARCHAR(10)  NOT NULL,      -- string|color|boolean|number|image|days
    UpdatedBy NVARCHAR(128) NULL,
    UpdatedAt DATETIME2     NULL
);

CREATE TABLE Announcements (
    Id        UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    Title     NVARCHAR(100)  NOT NULL,
    Body      NVARCHAR(2000) NULL,
    Kind      NVARCHAR(10)   NOT NULL CHECK (Kind IN ('notice','closure')),
    StartDate DATE NULL,
    EndDate   DATE NULL,
    CreatedAt DATETIME2      NOT NULL DEFAULT SYSUTCDATETIME(),
    CreatedBy NVARCHAR(128)  NULL
);

CREATE TABLE AuditLog (
    Id         BIGINT IDENTITY(1,1) PRIMARY KEY,
    [Action]   NVARCHAR(50)   NOT NULL,     -- role_changed, user_deactivated, booking_status_changed, ...
    TargetType NVARCHAR(50)   NOT NULL,
    TargetId   NVARCHAR(200)  NULL,
    Details    NVARCHAR(1000) NULL,
    ActorUid   NVARCHAR(128)  NULL,
    ActorName  NVARCHAR(100)  NULL,
    CreatedAt  DATETIME2      NOT NULL DEFAULT SYSUTCDATETIME()
);
CREATE INDEX IX_AuditLog_CreatedAt ON AuditLog (CreatedAt DESC);
```

---

## 6. Auth strategy for SSMS

- **Firebase Auth stays** for identity (email + Google + Facebook + phone OTP) — already set up, battle-tested.
- Frontend sends the Firebase **ID token** (`Authorization: Bearer <idToken>`) to the API.
- API validates it with the `firebase-admin` SDK and maps `uid` → `Users.Id`.
- **No passwords stored in SQL Server**; same login UX.
- Server-side session expiry, MFA (admin), and rate limiting become possible here — things Firestore rules can't do.

---

## 7. Migration steps (when client says go)

1. **Scaffold** — ✅ **DONE (Aug 17, 2026):** ASP.NET Core Web API (`.NET 8`) + Swashbuckle lives in [`api/`](../api/). Run with `cd api && dotnet run --urls http://localhost:5090`, open `http://localhost:5090/swagger`. Demo auth via `X-User-Id` header (`demo-admin` / `demo-user`).
2. **Schema** — run the `CREATE TABLE` script above (or EF Core migrations).
3. **Export** — script (Node + service account, like existing `scripts/*.mjs`) that reads every collection and writes JSON per table.
   Existing reusable scripts: `seed-firestore.mjs`, `inspect-bookings.mjs`, `clean-test-data.mjs`, `backfill-emails.mjs`, `deploy-rules.mjs`.
4. **Transform/import** — map Firestore types → SQL (ISO strings → `DATETIME2`, `active` → `IsActive`, autoIds → GUIDs, base64 stays as-is).
5. **Endpoints** — implement the API below, replicating every rule in §4.
6. **Frontend switch** — replace `firebase/firestore` calls with `fetch` to the API (keep `firebase/auth`). Biggest chunk of work.
7. **Cutover** — point the app at the API + SQL Server, verify data parity, decommission Firestore reads.

---

## 8. Proposed REST endpoints (Swagger will document these)

```
POST   /api/auth/verify                — Firebase token → user (create-if-missing)
GET    /api/users                      — admin: list users + booking counts + search
PATCH  /api/users/{id}/role            — admin (never the last admin)
PATCH  /api/users/{id}/active          — admin deactivate/reactivate
DELETE /api/users/me                   — self-account deletion (data + profile + auth)
GET    /api/resources                  — public (active only by default)
POST   /api/resources                  — admin
PATCH  /api/resources/{id}             — admin
DELETE /api/resources/{id}             — admin (soft: IsActive=0)
GET    /api/bookings/mine              — own bookings (live via SignalR)
POST   /api/bookings                   — create (status forced 'pending', slot unique)
PATCH  /api/bookings/{id}/cancel       — owner cancel (pending/confirmed → cancelled)
PATCH  /api/bookings/{id}/status       — admin confirm/complete/cancel
DELETE /api/bookings/{id}              — admin
GET    /api/settings                   — public branding subset
PUT    /api/settings                   — admin (branding, maintenance, booking hours, Viber)
GET    /api/announcements              — signed-in users
POST   /api/announcements              — admin (notice | closure with date range)
DELETE /api/announcements/{id}         — admin
GET    /api/audit                      — admin (immutable trail)
GET    /api/admin/stats                — dashboard KPIs + charts
POST   /api/notifications/viber        — server-side Viber send (token stays server-side!)
```

Every mutation writes an `AuditLog` row server-side.

---

## 9. Real-time & concurrency notes

- **Live pending → confirmed** (Firestore `onSnapshot` today): use **SignalR** (WebSocket) so My Bookings + admin dashboard update without refresh.
- **Atomic slot conflict:** SQL `UNIQUE (ResourceId, StartTime)` — the API catches the duplicate-key error and returns "slot taken", mirroring the current `SlotTakenError`.
- **FCM push + Viber notifications:** move sends to the server — this is what finally removes the **Viber token exposure** (token lives in `Settings` table, only the server reads it).

---

## 10. Known quirks / data notes (read before migrating)

- `start_ms` exists only on bookings created **after Aug 16, 2026** — older rows lack it (fine: it's just a mirror of `start_time`; SQL uses the real `DATETIME2`).
- `avatar_url` / `logo_url` are **base64 data URLs** (free-plan workaround, no Firebase Storage). Keep as-is in SQL, or migrate to blob storage later.
- `booking_history` is permanent; `cancelled` rows stay. `bookings` slot docs are **deleted** on cancel — the SQL `Bookings` table keeps the record (status) instead.
- Settings `value` can be string `"true"`/`"false"` (legacy writes) — the API must coerce like `SettingsContext.parseValue`.
- Demo credentials: `admin@booking.test / Admin123!`, `user@booking.test / User123!` — all emails marked **verified** (Aug 16, 2026).

---

## 11. What stays the same after migration

- PWA + mobile install + bottom nav
- Dynamic branding (logo, colors, app name) — now served from `Settings` table
- Maintenance mode, closed days, booking hours/slot duration (all configurable, no redeploy)
- Announcements + scheduled closures
- Light/dark theme, EN/FIL toggle
- Google / Facebook / phone login (Firebase Auth remains)

---

## 12. Living changelog (keep updated)

| Date | What changed | State |
|---|---|---|
| Aug 13, 2026 | Plan created; initial data model + endpoint sketch | Draft |
| Aug 16, 2026 | **Security hardening batch:** added `audit_log` collection + admin viewer; input-length caps in rules; `start_ms` past-date enforcement; email-verification gate (rules + UI, seed users verified); deactivated-user enforcement + admin user actions; status-forgery fix (`status='pending'` required); owner account-deletion; idle auto-signout; min-8 password validation; CSP/security headers in `firebase.json` | Live in Firebase |
| Aug 16, 2026 | **Booking reminders:** client-side hook (`useBookingReminders`, works on free plan while app is open — toast + system notification, per-device dedup via localStorage) + scheduled Cloud Function `sendBookingReminders` (`/functions`, every 5 min, FCM push before confirmed bookings, stamps `reminder_sent_at` — requires Blaze). **Lead time is admin-configurable** via `system_settings/booking_reminder_minutes` (15–180 min) **plus an optional days-before reminder** via `system_settings/booking_reminder_days` (0=off, 1–7 days, separate `reminder_day_sent_at` stamp) — both read by the hook and the function. **Notification deep-link:** tapping any reminder (toast "View" action, SW notification click, FCM push) opens `/my-bookings` (SW reads `data.url`) | Live in app; function ready-to-deploy |
| Aug 17, 2026 | **API scaffold:** `api/` ASP.NET Core Web API (.NET 8) + Swagger UI; EF Core InMemory demo DB (SQL Server via `DefaultConnection`); endpoints: users, resources, bookings (anti-double-booking via unique slot), settings, announcements, admin stats, audit; Swagger locked (dev-only + `ALLOW_SWAGGER`/`X-Swagger-Key` for prod demos) | Scaffolded (works) |
| — | Export script (Firestore → JSON per table) | TODO |
| — | SQL schema import + data parity check | TODO |
| — | Firebase ID-token validation in API (replace `X-User-Id` demo header) | TODO |
| — | Frontend data-layer switch | TODO |
| — | Cutover + decommission Firestore | TODO |

---

*Maintained as part of the booking-system repo. Update §3, §4, §5, and §12 whenever the app's data model or security posture changes.*
