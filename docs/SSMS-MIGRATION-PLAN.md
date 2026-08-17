# SSMS Migration — Kumpletong Plano (Complete Migration Plan)

> **Status: PLAN COMPLETE + API SCAFFOLDED (Aug 17, 2026).** Ang dokumentong ito ang
> **iisang source of truth** para sa paglipat ng Booking System mula Firebase
> (Firestore) papuntang **SQL Server (SSMS) + ASP.NET Core API + Swagger**. Layunin:
> **walang feature na maiiwan, walang kulang na endpoint, walang mawawalang data.**
>
> **Last updated: Aug 17, 2026.**

---

## Talaan ng Nilalaman

1. [Status at layunin](#1-status-at-layunin)
2. [Kasalukuyang sistema (Firebase) — kumpletong imbentaryo](#2-kasalukuyang-sistema)
3. [Target na arkitektura](#3-target-na-arkitektura)
4. [Data model: Firestore ↔ SQL Server mapping](#4-data-model)
5. [SQL Server schema (SSMS)](#5-sql-server-schema)
6. [Kumpletong API surface — lahat ng endpoints](#6-kumpletong-api-surface)
7. [Feature-by-feature migration (walang maiiwan)](#7-feature-by-feature-migration)
8. [Security requirements](#8-security-requirements)
9. [Data migration: export → transform → import](#9-data-migration)
10. [Frontend data-layer switch](#10-frontend-switch)
11. [Real-time at concurrency](#11-real-time-at-concurrency)
12. [Testing at parity checklist](#12-testing-at-parity-checklist)
13. [Deployment plan](#13-deployment-plan)
14. [Rollback plan](#14-rollback-plan)
15. [Phases at timeline](#15-phases-at-timeline)
16. [Definition of Done — checklist](#16-definition-of-done)
17. [Known quirks](#17-known-quirks)
18. [Changelog](#18-changelog)

---

## 1. Status at layunin

**Bakit tayo nagmi-migrate:** gusto ng client na nasa **SQL Server (SSMS)** ang database
at may **Swagger API** — para mas madaling i-manage, i-audit, at i-scale ang system.

**Kasalukuyang estado (Aug 17, 2026):**
- ✅ **Live system:** React PWA → Firebase Auth + Firestore (ito ang ginagamit ngayon)
- ✅ **API scaffold:** `api/` — ASP.NET Core (.NET 8) + Swagger, 17 endpoints, gumagana (InMemory DB)
- ⏳ **Hindi pa tapos:** data migration, token validation, notifications server-side, frontend switch

**Prinsipyo ng migration:**
1. **Walang downtime** — patuloy na gumagana ang Firebase habang inihahanda ang API
2. **Walang data loss** — lahat ng koleksyon ay may export script at parity check
3. **Walang feature regression** — bawat Firebase feature ay may katumbas sa API (tingnan §7)
4. **Madaling i-rollback** — kung may mali, bumalik sa Firebase (tingnan §14)

---

## 2. Kasalukuyang sistema (Firebase) — kumpletong imbentaryo

> Ito ang **buong** listahan ng kung ano ang ginagawa ng system ngayon. Ang bawat
> item dito ay dapat may katumbas pagkatapos ng migration — kung wala, kulang tayo.

### 2.1 Firebase collections (7 koleksyon)

| Collection | Doc ID | Nilalaman |
|---|---|---|
| `profiles/{uid}` | Firebase UID | Profile, role, active flag, avatar, FCM token |
| `resources/{id}` | auto | Bookable resources (name, desc, active) |
| `bookings/{resourceId}__{startISO}` | deterministic | **Slot occupancy** — anti-double-booking |
| `booking_history/{autoId}` | auto | **Permanent** booking records (status lifecycle) |
| `system_settings/{key}` | key name | Branding, maintenance, hours, Viber, reminders |
| `announcements/{id}` | auto | Notices + scheduled closures |
| `audit_log/{id}` | auto | **Immutable** admin action trail |

### 2.2 Auth methods (lahat gumagana)

- Email + password (may **password strength meter**, show/hide, forgot password, email verification)
- **Phone number** (OTP via Firebase)
- **Google login** (OAuth popup)
- **Facebook login** (OAuth popup)
- Quick-login demo buttons (dev only)

### 2.3 User features

| Feature | Saan | API katumbas (§6) |
|---|---|---|
| Home page: hero, resources, availability, announcements | HomePage | `GET /api/resources`, `GET /api/settings/public`, `GET /api/announcements` |
| Book flow: pick resource → date → slot → confirm | BookingPage | `POST /api/bookings` |
| Availability dots + slot count per day | BookingPage | `GET /api/bookings/availability` **(GAP)** |
| My Bookings: list, filter, search | MyBookingsPage | `GET /api/bookings/mine` |
| Cancel booking | MyBookingsPage | `PATCH /api/bookings/{id}/cancel` |
| **Reschedule** (cancel + bagong slot) | MyBookingsPage | cancel + `POST /api/bookings` |
| **Book again** (from history) | MyBookingsPage | `POST /api/bookings` |
| Profile: edit name, phone, avatar | ProfilePage | `PATCH /api/users/me`, `POST /api/users/me/avatar` **(GAP)** |
| Push notifications enable/disable | ProfilePage | `PATCH /api/users/me` (fcm_token) |
| Delete my account | ProfilePage | `DELETE /api/users/me` |
| Real-time status update (pending → confirmed live) | MyBookingsPage | **SignalR** **(GAP)** |
| Booking reminders (toast + push) | system-wide | server job **(GAP)** |
| First-booking celebration, walkthrough | system-wide | frontend lang (walang API) |

### 2.4 Admin features

| Feature | Saan | API katumbas (§6) |
|---|---|---|
| Dashboard: KPIs, charts, pending approvals, recent | AdminDashboard | `GET /api/admin/stats` |
| Bookings: search, filter, confirm/complete/cancel/delete, **CSV export** | AdminBookingsPage | `GET /api/bookings`, `PATCH /api/bookings/{id}/status`, `DELETE /api/bookings/{id}`, `GET /api/bookings/export` **(GAP)** |
| Resources: add/edit/deactivate | AdminResourcesPage | `POST/PATCH/DELETE /api/resources` |
| Users: list, search, role change, deactivate | AdminUsersPage | `GET /api/users`, `PATCH /api/users/{id}/role`, `PATCH /api/users/{id}/active` |
| Announcements: post/delete notice o closure | AdminSettingsPage | `POST/DELETE /api/announcements` **(edit = GAP)** |
| Settings: branding (logo crop, colors), maintenance, hours, reminders, Viber, closed days | AdminSettingsPage | `GET/PUT /api/settings` |
| Audit log viewer | AdminSettingsPage | `GET /api/audit` |

### 2.5 System features

| Feature | Detail |
|---|---|
| Dynamic branding | logo (zoom/crop), primary/accent/background color, app name — lahat naka-store sa DB |
| Maintenance mode | toggle + custom message; block non-admin |
| Booking hours | open/close time, slot duration, closed days — configurable, walang code change |
| Reminders | minutes-before (15–180) + days-before (0–7), admin-configurable |
| Viber notifications | notify admin sa bagong booking (token naka-store sa settings) |
| FCM push | status change + reminders (2 Cloud Functions) |
| PWA | installable, offline banner, service worker |
| EN/FIL language toggle, light/dark theme | frontend lang |
| Idle auto-signout (15 min) | frontend lang |

---

## 3. Target na arkitektura

```
[React PWA frontend]  →  [ASP.NET Core API + Swagger]  →  [SQL Server (SSMS)]
        │                            │
        ├─ Firebase Auth (nananatili!) ┘
        └─ SignalR (WebSocket) para sa real-time
```

- **Identity:** Firebase Auth **mananatili** (email/phone/Google/Facebook) — walang password na itatago sa SQL
- **Data:** SQL Server — lahat ng koleksyon magiging tables
- **Real-time:** SignalR imbes na Firestore `onSnapshot`
- **Push:** server-side (FCM) — inalis ang pangangailangan sa Cloud Functions
- **Viber token:** server-side na (hindi na exposed sa browser)

---

## 4. Data model: Firestore ↔ SQL Server mapping

| Firestore | SQL Server | Mapping notes |
|---|---|---|
| `profiles/{uid}` | `Users` | `uid` → `Id` (NVARCHAR 128) |
| `resources/{id}` | `Resources` | autoId → `Id` (GUID) |
| `bookings/{resourceId}__{startISO}` + `booking_history/{autoId}` | `Bookings` | **isang table** — slot doc + history nag-collapse; `UNIQUE (ResourceId, StartTime)` ang anti-double-booking |
| `system_settings/{key}` | `Settings` | `value` → string; API nag-cast by `ValueType` |
| `announcements/{id}` | `Announcements` | autoId → GUID |
| `audit_log/{id}` | `AuditLog` | append-only, `IDENTITY` PK |

**Field mapping ng `Users`:**

| Firestore `profiles` | SQL `Users` | Type |
|---|---|---|
| `full_name` | `FullName` | NVARCHAR(100) |
| `role` | `Role` | NVARCHAR(10) CHECK ('admin','user') |
| `email` | `Email` | NVARCHAR(254) NULL |
| — | `EmailVerified` | BIT (mula Firebase Auth) |
| `phone` | `Phone` | NVARCHAR(30) NULL |
| `active` | `IsActive` | BIT |
| `avatar_url` | `AvatarUrl` | NVARCHAR(MAX) (base64) |
| `fcm_token` | `FcmToken` | NVARCHAR(500) |
| — | `SignInProvider` | NVARCHAR(20) (email/google/facebook/phone) |
| `created_at` / `updated_at` | `CreatedAt` / `UpdatedAt` | DATETIME2 |

**Field mapping ng `Bookings`:**

| Firestore | SQL `Bookings` | Notes |
|---|---|---|
| `user_id` | `UserId` | FK → Users |
| `resource_id` | `ResourceId` | FK → Resources |
| `start_time` / `start_ms` | `StartTime` | DATETIME2 (ang `start_ms` ay mirror lang — hindi na kailangan) |
| `end_time` | `EndTime` | DATETIME2 |
| `status` | `Status` | CHECK ('pending','confirmed','cancelled','completed') |
| `notes` | `Notes` | NVARCHAR(500) |
| `created_at` | `CreatedAt` | DATETIME2 |

---

## 5. SQL Server schema (SSMS)

> Ipatakbo ito sa SSMS laban sa bagong database. Ito ang **awtoritatibong schema**
> — kung magbago ang app, i-update ito at ang §4.

```sql
-- ===========================================================================
-- Booking System — SQL Server schema (migration target)
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

## 6. Kumpletong API surface — lahat ng endpoints

> **Berde = naka-implement na sa `api/` scaffold.**
> **🔴 = GAP — kailangan i-add bago ang migration.**

### 6.1 Auth
| Method | Endpoint | State |
|---|---|---|
| POST | `/api/auth/verify` — Firebase ID token → user (create-if-missing) | 🔴 GAP |

### 6.2 Users
| Method | Endpoint | State |
|---|---|---|
| GET | `/api/users` — list + search + booking counts | ✅ |
| PATCH | `/api/users/{id}/role` — admin | ✅ |
| PATCH | `/api/users/{id}/active` — admin deactivate/reactivate | ✅ |
| PATCH | `/api/users/me` — update profile (name, phone, fcm_token) | 🔴 GAP |
| POST | `/api/users/me/avatar` — upload avatar | 🔴 GAP |
| DELETE | `/api/users/me` — self-delete | ✅ |

### 6.3 Resources
| Method | Endpoint | State |
|---|---|---|
| GET | `/api/resources` — public (active) | ✅ |
| POST | `/api/resources` — admin | ✅ |
| PATCH | `/api/resources/{id}` — admin | ✅ |
| DELETE | `/api/resources/{id}` — admin soft-delete | ✅ |

### 6.4 Bookings
| Method | Endpoint | State |
|---|---|---|
| GET | `/api/bookings/availability?date=...` — slots per resource/day | 🔴 GAP |
| GET | `/api/bookings/mine` — own bookings | ✅ |
| GET | `/api/bookings` — admin list + filters | ✅ |
| GET | `/api/bookings/export` — admin CSV download | 🔴 GAP |
| POST | `/api/bookings` — create (status forced pending) | ✅ |
| PATCH | `/api/bookings/{id}/cancel` — owner | ✅ |
| PATCH | `/api/bookings/{id}/status` — admin | ✅ |
| DELETE | `/api/bookings/{id}` — admin | ✅ |

### 6.5 Settings
| Method | Endpoint | State |
|---|---|---|
| GET | `/api/settings/public` — branding + hours (walang secrets) | ✅ |
| GET | `/api/settings` — admin full (may Viber token) | ✅ |
| PUT | `/api/settings` — admin upsert | ✅ |
| POST | `/api/settings/logo` — logo image upload | 🔴 GAP |

### 6.6 Announcements
| Method | Endpoint | State |
|---|---|---|
| GET | `/api/announcements` | ✅ |
| POST | `/api/announcements` — admin | ✅ |
| PATCH | `/api/announcements/{id}` — admin edit | 🔴 GAP |
| DELETE | `/api/announcements/{id}` — admin | ✅ |

### 6.7 Stats, Audit, Notifications
| Method | Endpoint | State |
|---|---|---|
| GET | `/api/admin/stats` — dashboard KPIs | ✅ |
| GET | `/api/audit` — immutable trail | ✅ |
| POST | `/api/notifications/viber` — server-side Viber send | 🔴 GAP |
| POST | `/api/notifications/test-push` — admin test FCM | 🔴 GAP |
| — | SignalR hub `/hubs/bookings` — live updates | 🔴 GAP |
| — | Background job — booking reminders | 🔴 GAP |

---

## 7. Feature-by-feature migration (walang maiiwan)

> Ang checklist na ito ang **pinakamahalagang pahina**. Kapag kumpleto na ang lahat
> ng checkbox, handa na ang migration.

### 7.1 Auth
- [ ] `POST /api/auth/verify` — nagpapatunay ng Firebase ID token, gumagawa ng user row kung wala pa
- [ ] Frontend: ipadala ang token bilang `Authorization: Bearer <idToken>` sa lahat ng requests
- [ ] Alisin ang demo `X-User-Id` header (dev lang)
- [ ] Email verification + phone status sync sa `Users.EmailVerified` / `Phone`

### 7.2 Booking flow
- [ ] Availability endpoint — kailangan para sa calendar dots + slot count
- [ ] Create booking — **status always 'pending'**, slot conflict → 409
- [ ] Anti-double-booking: SQL `UNIQUE (ResourceId, StartTime)` + API pre-check (may both na sa scaffold)
- [ ] Maintenance mode check sa create
- [ ] Closed days + booking hours + slot duration validation sa create (server-side, hindi lang UI)
- [ ] Deactivated user → 403
- [ ] Unverified email/phone → 403 (hanggang hindi pa verified)

### 7.3 My Bookings
- [ ] List own bookings (may resource name)
- [ ] Cancel (owner lang, pending/confirmed → cancelled)
- [ ] Reschedule = cancel + create (frontend)
- [ ] **Live updates via SignalR** — pending → confirmed nang walang refresh

### 7.4 Admin
- [ ] Dashboard stats (totals, pending, upcoming, resources, users)
- [ ] Bookings table: search, filter, confirm/complete/cancel/delete
- [ ] **CSV export endpoint** (o frontend CSV mula sa list — pwede ring iwan sa frontend)
- [ ] Resources CRUD (soft-delete)
- [ ] Users: role change (hindi pwede i-demote ang sarili, huwag tanggalin ang huling admin)
- [ ] Announcements CRUD
- [ ] Settings: lahat ng keys + logo upload
- [ ] **Bawat mutation ay sumusulat ng AuditLog** (server-side, hindi kailanman galing sa client)

### 7.5 Notifications
- [ ] **FCM status push** (confirmed/cancelled) — gawing server-side (replacement ng Cloud Function)
- [ ] **Booking reminders** — background job (minutes-before + days-before, admin-configurable)
- [ ] **Viber** — token nasa `Settings` table, server lang ang nagbabasa, walang exposure sa browser
- [ ] Notification deep-link → `/my-bookings`

### 7.6 System/branding
- [ ] Dynamic branding mula sa `Settings` table (logo, colors, app name)
- [ ] Maintenance mode server-side
- [ ] PWA/offline — frontend lang, walang API change
- [ ] EN/FIL, light/dark — frontend lang

---

## 8. Security requirements

> Lahat ng Firestore rules enforcement ngayon (§4 ng lumang doc) ay dapat **replicated
> server-side**. May mga bago pang security na **hindi kaya ng Firestore**:

| Requirement | API implementation |
|---|---|
| Firebase ID-token validation | `[Authorize]` + middleware na nag-va-validate ng JWT (firebase-admin SDK) |
| Role check | `Users.Role == "admin"` per request |
| Deactivated user block | check `IsActive` sa bawat write |
| Input validation | `[MaxLength]` annotations + DTO validation (401/400/409) |
| **Rate limiting** | ASP.NET Rate Limiter — hal. 20 requests/min per user sa POST endpoints |
| **Server-side validation ng slots** | hours, closed days, duration, past dates — lahat sa API |
| **Audit trail** | bawat mutation → `AuditLog` row (server-side) |
| **Viber token** | server-side lang — hindi na nababasa ng browser |
| Swagger lock | dev-only; `ALLOW_SWAGGER=true` + `X-Swagger-Key` sa production demo |
| CORS | restrict sa production domain (hindi `*`) |
| HTTPS + security headers | naka-set na sa Vercel (CSP, HSTS, X-Frame-Options) — i-port sa API host |

---

## 9. Data migration: export → transform → import

> Ang order ay **critical**: i-export muna lahat, i-verify, bago mag-import.

### Hakbang 1 — Export (Firestore → JSON)
- Script: `scripts/export-firestore.mjs` (gagamitin ang service account, gaya ng `seed-firestore.mjs`)
- Output: `migration-export/` na may JSON per table:
  - `users.json`, `resources.json`, `bookings.json`, `settings.json`, `announcements.json`, `audit.json`
- **Idempotent** — pwede patakbuhin nang paulit-ulit nang walang duplicate

### Hakbang 2 — Transform (Firestore types → SQL types)
| Firestore | SQL |
|---|---|
| ISO string (`2026-08-17T02:00:00.000Z`) | `DATETIME2` |
| `start_ms` (mirror) | **hindi na kailangan** — ang `StartTime` na |
| `active` (bool) | `IsActive` (BIT) |
| autoId string | GUID (deterministic mapping — i-save ang mapping JSON para sa bookings.resource_id) |
| base64 (avatar, logo) | iwan as-is (NVARCHAR(MAX)) |
| `value` string `"true"`/`"false"` | i-cast by `ValueType` (gaya ng `SettingsContext.parseValue`) |

### Hakbang 3 — Import (JSON → SQL Server)
- Option A: **EF Core Seeder** — i-load ang JSON sa startup (may `DbSeeder` na)
- Option B: **SQL `BULK INSERT`** / SSMS Import Wizard — mas mabilis sa malalaking data
- **Order ng import:** Users → Resources → Bookings → Settings → Announcements → AuditLog (dahil sa FK)

### Hakbang 4 — Parity check
- Script: `scripts/verify-parity.mjs` — binibilang ang rows sa Firestore vs SQL
- **Dapat zero ang difference** sa: users, resources, bookings, settings, announcements
- Spot-check: random bookings → i-compare ang lahat ng fields

---

## 10. Frontend data-layer switch

> Ang pinakamalaking bahagi ng trabaho. Ang UI ay **hindi magbabago** — ang data
> layer lang ang papalitan (`firebase/firestore` → `fetch` sa API).

### Strategy: service layer wrapper
Gumawa ng `src/api/` folder na may isang module per resource:

```
src/api/
  client.ts      — fetch wrapper (Bearer token, base URL, error handling)
  auth.ts        — POST /api/auth/verify
  users.ts       — users endpoints
  resources.ts   — resources endpoints
  bookings.ts    — bookings + availability
  settings.ts    — settings endpoints
  announcements.ts
```

**Step-by-step:**
1. Gumawa ng `client.ts` (may token mula sa Firebase Auth, auto-refresh)
2. Palitan ang `useAuth.ts` profile reads → `GET /api/users/me` (panatilihin ang Firebase Auth para sa sign-in)
3. Palitan ang `useResources.ts` → `GET/POST/PATCH /api/resources`
4. Palitan ang `useBookings.ts` → bookings endpoints + availability
5. Palitan ang `useSettings.ts` → settings endpoints
6. Palitan ang `useAnnouncements.ts` → announcements endpoints
7. Palitan ang `useAuditLog.ts`, `useUsers.ts` → admin endpoints
8. Palitan ang `useAdminNotifications.ts` → **SignalR client**
9. Alisin ang `firebase/firestore` imports (iwan ang `firebase/auth` + `firebase/messaging`)
10. I-update ang `firestore.rules` → hindi na kailangan (API na ang nag-e-enforce)

**Toggle strategy (para sa zero-risk):** magdagdag ng `VITE_API_BASE_URL` env var —
kung walang laman, gamitin ang Firestore; kung may laman, gamitin ang API. Pwede
i-test ang API sa isang environment habang ang production ay Firestore pa.

---

## 11. Real-time at concurrency

| Ngayon (Firestore) | Mamaya (API) |
|---|---|
| `onSnapshot` sa bookings | **SignalR** hub — client nag-subscribe, server nag-push ng status changes |
| Deterministic slot doc + `merge:false` | SQL `UNIQUE (ResourceId, StartTime)` + API pre-check (may both) |
| Firestore rules validation | Server-side validation (lahat ng rules → C# code) |

**SignalR design:**
- Hub: `/hubs/bookings`
- Events: `BookingUpdated(bookingId, status)`, `NewBooking(resourceId)`
- Admin dashboard: subscribe sa `NewBooking` (live pending count)
- User My Bookings: subscribe sa `BookingUpdated` (live pending → confirmed)

---

## 12. Testing at parity checklist

> Bago i-cutover, dapat pumasa ang lahat ng ito. Gagamitin ang **TESTING_SUMMARY.md**
> na nagawa na bilang baseline.

### 12.1 API unit/integration tests (xUnit)
- [ ] Create booking → status always `pending`
- [ ] Double-booking same slot → 409
- [ ] Deactivated user → 403
- [ ] Unverified email → 403
- [ ] Maintenance on → 503
- [ ] Past date → 400
- [ ] Owner cancel → ok; non-owner cancel → 403
- [ ] Admin confirm/complete/cancel → ok
- [ ] Last-admin cannot be demoted
- [ ] Self-deactivate blocked
- [ ] Bawat mutation may audit row

### 12.2 E2E parity (Firebase vs API — parehong scenario)
| Scenario | Firebase result | API result | Match? |
|---|---|---|---|
| User books | pending | pending | ☐ |
| Admin confirms | confirmed | confirmed | ☐ |
| Double-booking | blocked | 409 | ☐ |
| Deactivated user | blocked | 403 | ☐ |
| Maintenance mode | blocked | 503 | ☐ |
| CSV export | gumagana | gumagana | ☐ |

### 12.3 Frontend regression (gamit ang API toggle)
- [ ] Buong booking flow (user) — desktop + mobile
- [ ] Admin: bookings, resources, users, settings, announcements
- [ ] Notifications: FCM status push + reminders + Viber
- [ ] Live updates via SignalR
- [ ] Dark/light, EN/FIL, PWA install, offline

---

## 13. Deployment plan

### 13.1 API hosting options
| Option | Gastos | Notes |
|---|---|---|
| **Azure App Service (Free tier)** | ₱0 | Pinaka-natural na pares ng SSMS + .NET; may free F1 tier |
| VPS (DigitalOcean / Vultr) | ~$6/mo | Full control; ikaw ang bahala sa SQL Server |
| **SQL Server hosting** | — | Azure SQL free tier (100K DTU-seconds/mo) o SQL Server Express (local) |

### 13.2 Environment variables (API)
```
ConnectionStrings__DefaultConnection=<SQL connection string>
ALLOW_SWAGGER=false
SWAGGER_KEY=<random strong key>
JWT_ISSUER=booking-system (firebase project id)
```

### 13.3 Frontend (Vercel)
```
VITE_API_BASE_URL=https://api.yourdomain.com   ← i-set lang ito para mag-switch sa API
```

### 13.4 DNS
- `api.yourdomain.com` → Azure/VPS
- `app.yourdomain.com` → Vercel (frontend)
- HTTPS (auto via Azure/Vercel)

---

## 14. Rollback plan

> Dahil sa **toggle strategy** (§10), ang rollback ay isang env var lamang.

**Paano mag-rollback:**
1. I-set ang `VITE_API_BASE_URL` sa walang laman (o i-deploy ang lumang build)
2. → Bumalik ang frontend sa Firestore
3. Walang data loss: ang Firestore ay **hindi tinatanggal** hanggang stable ang API nang ilang linggo

**Kailan ligtas tanggalin ang Firestore:**
- 2–4 na linggo na walang rollback
- Parity check paulit-ulit na pumasa
- Napagkasunduan ng client

---

## 15. Phases at timeline

| Phase | Gawain | Est. |
|---|---|---|
| **Phase 1 — API gaps** | I-fill ang 🔴 GAP endpoints (§6): auth/verify, users/me, availability, export, notifications, SignalR, reminders job, audit writes | 3–5 araw |
| **Phase 2 — Tests** | xUnit tests + parity checklist (§12) | 2 araw |
| **Phase 3 — Export/Import** | export-firestore.mjs, transform, import, parity verify | 2 araw |
| **Phase 4 — Frontend switch** | `src/api/` wrapper + toggle + palitan ang hooks | 3–5 araw |
| **Phase 5 — Deployment** | Azure/VPS + SQL Server + DNS + env vars | 1–2 araw |
| **Phase 6 — Cutover** | i-on ang API sa production, i-verify, i-monitor | 1 araw |
| **Phase 7 — Decommission** | tanggalin ang Firestore reads, i-update ang docs | 1 araw |

**Kabuuang estimate:** ~2 linggo ng focused na trabaho.

---

## 16. Definition of Done — checklist

> **Handa na ang cutover kapag LAHAT ng ito ay ✅:**

- [ ] Lahat ng 🔴 GAP endpoints ay implemented at naka-test
- [ ] Lahat ng Firestore rules enforcement ay nasa API (§7, §8)
- [ ] Lahat ng data ay na-export, na-import, at na-verify (parity = 0 diff)
- [ ] Lahat ng feature ay gumagana via API (walang nawala — §7 checklist)
- [ ] Bawat mutation ay may audit row
- [ ] Notifications (FCM + Viber + reminders) ay gumagana server-side
- [ ] SignalR live updates gumagana (admin + user)
- [ ] Swagger ay locked (hindi exposed sa production)
- [ ] Rate limiting + CORS + HTTPS ay naka-configure
- [ ] Buong E2E testing pumasa (desktop + mobile, user + admin)
- [ ] Rollback plan ready (toggle env var)
- [ ] Documentation updated (ito mismo)
- [ ] Client approval

---

## 17. Known quirks

- `start_ms` ay mirror lang ng `start_time` — hindi na kailangan sa SQL (may real `DATETIME2`)
- `avatar_url` / `logo_url` ay base64 data URLs (free-plan workaround) — iwan as-is o i-migrate sa blob storage later
- `booking_history` ay permanent; ang `bookings` slot docs ay **dine-delete** on cancel — sa SQL, isang `Bookings` table na lang na may `Status='cancelled'`
- Settings `value` ay minsang string `"true"`/`"false"` (legacy) — dapat i-coerce ng API (gaya ng `SettingsContext.parseValue`)
- Demo credentials: `admin@booking.test / Admin123!`, `user@booking.test / User123!` — **palitan bago production**
- Ang `api/` scaffold ay gumagamit ng InMemory DB — ang InMemory ay **hindi nag-e-enforce ng unique index**, kaya may explicit pre-check na rin sa code (gumagana sa pareho)

---

## 18. Changelog

| Date | What changed | State |
|---|---|---|
| Aug 13, 2026 | Plan created; initial data model + endpoint sketch | Draft |
| Aug 16, 2026 | Security hardening batch (audit_log, input caps, email gate, deactivated users, status forgery fix, CSP) | Live in Firebase |
| Aug 16, 2026 | Booking reminders (client hook + Cloud Function, configurable minutes/days) | Live in app; function ready |
| Aug 17, 2026 | **API scaffold:** `api/` ASP.NET Core (.NET 8) + Swagger, 17 endpoints, InMemory demo DB | ✅ Scaffolded |
| Aug 17, 2026 | **Kumpletong migration plan na ito** — feature inventory, gaps, endpoints, security, phases, DoD | ✅ Plan complete |
| — | Phase 1: API gaps | TODO |
| — | Phase 2–7: tests, export/import, frontend switch, deploy, cutover | TODO |

---

*Maintained as part of the booking-system repo. I-update ang §2, §4, §5, §6, §7, at §18 kapag may
pagbabago sa app o API.*
