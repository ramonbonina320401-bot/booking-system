# Booking System — Conversation Summary (para sa bagong thread)

> I-paste ang file na ito sa bagong thread para may kumpletong context. **Last updated: Aug 17, 2026.**

---

## 1. Project Overview

**Booking System** — full-stack dynamic booking platform na may:
- **Frontend:** React PWA (Vite) — installable sa mobile, gumagana offline
- **Backend (kasalukuyan):** Firebase (Auth + Firestore + FCM) — client-only, walang sariling server
- **Backend (hinaharap):** ASP.NET Core API + Swagger + SQL Server (SSMS) — naka-scaffold na, hindi pa live
- **Deployed sa:** Vercel (`https://booking-system-zeta-seven.vercel.app`)

**Repo (GitHub):** `ramonbonina320401-bot/booking-system` — naka-push lahat ng changes
**Local path:** `C:\Users\Rj\Documents\GitHub\booking-system`

---

## 2. Demo Accounts

| Role | Email | Password |
|---|---|---|
| **Admin** | `admin@booking.test` | `Admin123!` |
| **User** | `user@booking.test` | `User123!` |

- May **autofill buttons** mismo sa login page (dev builds lang)
- ⚠️ **Palitan bago ang production!** (nasa TESTING_SUMMARY.md at migration plan)

**Firebase project:** `booking-system-41a4b`
**Service account key:** `C:\Users\Rj\Downloads\booking-system-41a4b-firebase-adminsdk-fbsvc-12b4f90f51.json`

---

## 3. Kasalukuyang Estado (Local = GitHub = Vercel ✅)

- **Local vs GitHub:** naka-sync — walang uncommitted changes (maliban sa `.freebuff/` na tool metadata)
- **GitHub vs Vercel:** parehong version. ✅ **Na-fix ang authDomain issue** (dati ang Vercel ay may API key bilang authDomain — ngayon tama na: `booking-system-41a4b.firebaseapp.com`)
- **Latest commits:**
  - `09edc1d` — Add complete SSMS migration plan (docs)
  - `c632f28` — Add ASP.NET Core Web API skeleton with Swagger (`api/`)
  - `d788589` — Polish admin branding UX + Firestore rules fix

---

## 4. Lahat ng Features na Gumagana

### User side
- Email/password login (may show/hide password + strength meter), Phone OTP, **Google login**, **Facebook login**
- Forgot password, email verification
- Home page: hero, resources with availability, announcements, quick actions
- Booking flow: resource → date (calendar with availability dots + quick chips) → slot → confirm → success screen
- My Bookings: list, filter/search, cancel, **reschedule**, **book again**, live status updates (Firestore onSnapshot)
- Profile: edit name/phone, avatar upload, push toggle, delete account
- PWA install (iOS instructions), offline banner, push notifications (FCM)

### Admin side
- Dashboard: KPIs (clickable), charts, pending approvals, recent bookings
- Bookings: search, filters, confirm/complete/cancel/delete, **CSV export**, phone number ng user
- Resources: add/edit/deactivate
- Users: search, role filter, role change, deactivate, email shown
- Settings: branding (logo zoom/crop, colors, app name — lahat dynamic), maintenance mode, booking hours (open/close/slot/closed days), reminders (minutes + days), Viber, announcements, audit log
- Notification bell (pending count, real-time)

### System
- EN/FIL language toggle, light/dark theme (default white/light)
- Dynamic branding (DB-driven — walang code change)
- Maintenance mode (blocks non-admin)
- Idle auto-signout (15 min)
- Security hardening: Firestore rules (input caps, status-forgery fix, email gate, deactivated users, audit_log)

---

## 5. ✅ Naka-commit at Naka-push

### `api/` folder — ASP.NET Core Web API + Swagger (scaffold, gumagana)
- .NET 8 + Swashbuckle, EF Core (InMemory demo DB; SQL Server via `DefaultConnection`)
- **17 endpoints:** users, resources, bookings (anti-double-booking → 409), settings, announcements, admin stats, audit
- Swagger **locked**: dev-only; production naka-hide unless `ALLOW_SWAGGER=true` + `X-Swagger-Key` header
- Run: `cd api && dotnet run --urls http://localhost:5090` → `http://localhost:5090/swagger`
- Demo auth: header `X-User-Id: demo-admin` o `demo-user`
- **Hindi pa konektado sa live system** — hiwalay na prototype para sa future SSMS migration

### `docs/SSMS-MIGRATION-PLAN.md` — kumpletong migration plan (632 lines)
Single source of truth para sa Firestore → SQL Server migration:
- Feature inventory, API gap analysis, SQL schema, security, data export/import, frontend switch (toggle strategy), testing parity, deployment, rollback, timeline, definition-of-done
- **Ang 🔴 GAP endpoints na kailangan i-add:** auth/verify, availability, users/me, avatar upload, bookings/export, announcements edit, settings/logo, notifications/viber, SignalR hub, reminders job

### `docs/SSMS-SWAGGER-MIGRATION.md` — technical reference (data model, schema, endpoint mapping)

---

## 6. 🔴 Ang mga Alam na Hindi Pa Tapos

1. **Viber notifications** — code ready pero **walang token** (viber_enabled=false, token/admin_id empty). Kailangan: gumawa ng Viber bot sa partners.viber.com, i-configure sa Settings → Viber
2. **SSMS migration** — i-defer sa huli (client: "sunod dapat meron karin swagger" → naka-scaffold na ang API, pero hindi pa nagmi-migrate)
3. **Swagger API gaps** — 10 endpoints pa ang kailangan (§6 ng migration plan)
4. **Phone OTP** — dapat i-enable sa Firebase console (Authenticate → Sign-in method → Phone)
5. **Cloud Functions (reminders)** — ready-to-deploy pero nangangailangan ng Blaze plan (client-side hook ang gumagana sa free plan habang bukas ang app)
6. **Demo passwords** — palitan bago production

---

## 7. Mahahalagang Aral / Notes

- **Thread workspace ay `plv-navisync`!** — nangyari ito: ang write_file na may relative path (`api/...`) ay napunta sa **maling project** (`plv-navisync`). **Palaging gumamit ng absolute path** (`C:\Users\Rj\Documents\GitHub\booking-system\...`) kapag nagsusulat ng files. Na-clean na ito, malinis ang plv-navisync.
- **EF Core InMemory ay hindi nag-e-enforce ng unique index** — may explicit pre-check din sa code (gumagana sa pareho)
- **Firestore rules bug na na-fix:** kapag walang `avatar_url` field ang profile doc, nag-fa-fail ang update ("Missing or insufficient permissions") — naayos gamit ang `in` operator + `fieldLenOk()`, deployed live
- **Ang demo accounts ay dev-only** — hindi lumalabas sa production bundle (intentional)
- **React-app lang ang frontend** — ang landing page (`/`) ay pareho para sa user at admin (nag-a-adapt lang ang content); walang auto-redirect sa /admin (napag-usapan, hindi ginawa)
- **Swagger = documentation + testing tool** ng API, hindi kapalit ng Firebase; ang Firebase Auth ay mananatili kahit mag-migrate sa SSMS

---

## 8. Mga Useful Commands

```bash
# Dev server (frontend)
cd /c/Users/Rj/Documents/GitHub/booking-system && npm run dev

# API + Swagger (ASP.NET)
cd /c/Users/Rj/Documents/GitHub/booking-system/api && dotnet run --urls http://localhost:5090

# Typecheck / build
cd /c/Users/Rj/Documents/GitHub/booking-system && npx tsc --noEmit && npm run build

# Firestore rules deploy (may service account sa Downloads)
node scripts/deploy-rules.mjs "C:\Users\Rj\Downloads\booking-system-41a4b-firebase-adminsdk-fbsvc-12b4f90f51.json"

# Git push
git add <files> && git commit -m "msg" && git push origin main
```

---

## 9. Kailan / Ano ang Susunod

1. **Finish Firebase features** (kung may natitira) + UI/UX polish
2. **Viber setup** (kung gusto ng client ng Viber notifications)
3. **I-fill ang API gaps** (Phase 1 ng migration plan) — kapag sinabi ng client na mag-migrate na
4. **SSMS migration** — sundan ang `docs/SSMS-MIGRATION-PLAN.md` (§15 phases)
5. **Production prep** — palitan ang demo passwords, i-verify ang Vercel env vars

---

*Ginawa para sa thread transfer. I-paste ang buong file sa bagong thread para may context.*
