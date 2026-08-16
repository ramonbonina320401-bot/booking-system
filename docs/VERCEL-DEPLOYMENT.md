# 🚀 Vercel Deployment Checklist — Booking System

Ito ang kumpletong checklist para ilive ang app sa **Vercel** (hosting + domain).
Ang database, auth, at rules ay **nasa Firebase pa rin** — ang Vercel lang ang nagse-serve
ng frontend. ~15 minuto lang ito kung sunod-sunod.

---

## ✅ Step 0 — Bago lahat (security, 5 min)

> **HUWAG muna i-deploy kung may buhay pang demo accounts.**
> `admin@booking.test / Admin123!` at `user@booking.test / User123!` ay naka-document
> sa README — sinumang makakita ng docs ay makakapasok bilang **admin**.

- [ ] **I-disable o i-delete ang demo accounts** (Admin → Users → Deactivate, o via script)
- [ ] Firebase console → ⚙️ Authentication → **Password policy** → min length 8
- [ ] Firebase console → ⚙️ Authentication → **Email enumeration protection** → enable
- [ ] I-verify na OFF ang maintenance mode (Settings → Maintenance) — nakumpirma: OFF ✓

---

## ✅ Step 1 — I-deploy ang Firestore rules (2 min)

Ang rules ay nasa Firebase pa rin (hindi Vercel). I-deploy muna bago ang frontend:

```bash
npx firebase-tools login
npx firebase-tools deploy --only firestore:rules
```

> Hindi ito kailangan ng card/blaze — libre ang rules deployment.
> (Scheduled Cloud Functions para sa FCM push = Blaze, pero SEPARATE — hindi hadlang sa hosting.)

---

## ✅ Step 2 — Gumawa ng `vercel.json` (2 min)

Kailangan ng Vercel ng dalawang bagay na automatic sa Firebase Hosting:

1. **SPA rewrites** — lahat ng routes (`/book`, `/my-bookings`, `/admin`) → `index.html`
2. **Security headers** (CSP, HSTS, nosniff) — ito ang nasa `firebase.json` ngayon, ililipat sa Vercel

Gawin ang `vercel.json` sa project root:

```json
{
  "rewrites": [
    { "source": "/((?!assets/|icons/|favicon.svg|manifest.json|sw.js|registerSW.js|theme.js).*)", "destination": "/index.html" }
  ],
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        {
          "key": "Content-Security-Policy",
          "value": "default-src 'self'; script-src 'self' https://www.google.com https://www.gstatic.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https://www.gstatic.com; font-src 'self' data:; connect-src 'self' https://identitytoolkit.googleapis.com https://securetoken.googleapis.com https://www.googleapis.com https://firestore.googleapis.com https://fcm.googleapis.com https://chatapi.viber.com https://www.google.com https://www.gstatic.com https://graph.facebook.com; frame-src https://accounts.google.com https://www.facebook.com https://www.google.com; worker-src 'self'; manifest-src 'self'; base-uri 'self'; form-action 'self' https://accounts.google.com https://www.facebook.com; frame-ancestors 'none'"
        },
        { "key": "X-Content-Type-Options", "value": "nosniff" },
        { "key": "X-Frame-Options", "value": "DENY" },
        { "key": "Referrer-Policy", "value": "strict-origin-when-cross-origin" },
        { "key": "Permissions-Policy", "value": "camera=(), microphone=(), geolocation=()" },
        { "key": "Strict-Transport-Security", "value": "max-age=31536000; includeSubDomains" }
      ]
    }
  ]
}
```

> ⚠️ Ang rewrite regex ay **excludes** sa `assets/`, `icons/`, at PWA files — kung hindi,
> ma-block ang service worker at installable PWA.

---

## ✅ Step 3 — Env variables sa Vercel (3 min)

Kailangan i-copy ang values mula sa local `.env` papunta sa Vercel:

**Vercel → Project → Settings → Environment Variables → Add** (lahat ng ito):

```
VITE_FIREBASE_API_KEY
VITE_FIREBASE_AUTH_DOMAIN
VITE_FIREBASE_PROJECT_ID
VITE_FIREBASE_STORAGE_BUCKET
VITE_FIREBASE_MESSAGING_SENDER_ID
VITE_FIREBASE_APP_ID
VITE_FIREBASE_VAPID_KEY
```

> Pwede mong buksan ang local `.env` at i-copy ang values. Huwag i-commit ang `.env` —
> nasa `.gitignore` na ito. Sa Vercel, i-add para sa **Production** (at Preview kung gusto mo).

---

## ✅ Step 4 — Import ang project sa Vercel (3 min)

1. Pumunta sa https://vercel.com → **Add New → Project**
2. I-import ang repo (kailangan naka-upload sa GitHub muna — kung hindi pa, `git push`)
3. Vercel ay **auto-detect** ng Vite. I-verify ang settings:
   - **Framework Preset:** `Vite` ✓
   - **Build Command:** `npm run build` ✓ (auto)
   - **Output Directory:** `dist` ✓ (auto)
4. I-click **Deploy**
5. Hintayin ang build (~1-2 min). I-verify na green.

---

## ✅ Step 5 — Firebase Auth: idagdag ang Vercel domain (CRITICAL ⚠️)

**Ito ang pinaka-madalas na nakakalimutan.** Kapag nag-deploy, mag-e-error ang
Google/Facebook login na "This domain is not authorized" kahit tama lahat ng env.

**Firebase console → ⚙️ Project settings → Authentication → Authorized domains → Add domain:**

```
your-project.vercel.app        ← ang default Vercel URL
yourdomain.com                 ← ang custom domain mo
www.yourdomain.com             ← kung may www
```

> Kung wala ito: **email/password login gagana**, pero Google at Facebook login
> ay **mag-fa-fail** sa production.

---

## ✅ Step 6 — Custom domain (2 min)

1. **Vercel → Project → Settings → Domains → Add**
2. Ilagay ang domain mo (hal. `booking.yourcompany.com`)
3. Sundan ang DNS instructions na ibibigay ng Vercel (A record / CNAME sa iyong domain registrar)
4. Hintayin ang DNS propagation (minuto hanggang oras)
5. I-verify na nagba-load ang site sa custom domain
6. I-verify na **green ang HTTPS lock** (automatic ang SSL sa Vercel)

---

## ✅ Step 7 — Post-deploy verification (5 min)

Buksan ang live URL at i-check ang LAHAT ng ito:

- [ ] **Login** — email/password login gumagana
- [ ] **Google login** — gumagana (patunay na tama ang authorized domains)
- [ ] **Facebook login** — gumagana
- [ ] **Booking flow** — pumili ng resource → date → slot → confirm → makikita sa My Bookings
- [ ] **Admin panel** — Dashboard, Bookings, Resources, Users, Settings
- [ ] **Dynamic branding** — palitan ang primary color sa Settings → makikita agad sa site
- [ ] **Dark/light mode** — gumagana ang toggle
- [ ] **Mobile** — buksan sa phone: bottom nav, install prompt
- [ ] **PWA install** — "Add to home screen" gumagana sa Android/desktop
- [ ] **Security headers** — i-check sa https://securityheaders.com o browser DevTools → Network → i-click ang document → Headers: may `Content-Security-Policy` ba?
- [ ] **Deep-link** — i-open ang `/my-bookings` nang direkta → hindi 404

---

## ⚠️ Mga alam na limitation sa Vercel setup na ito

| Feature | Katayuan |
|---|---|
| **Firestore + Auth** | ✅ Gumagana (nasa Firebase) |
| **PWA + offline shell** | ✅ Gumagana (static files served by Vercel) |
| **Client-side reminders** | ✅ Gumagana (nasa browser) |
| **FCM push (app closed)** | ⚠️ Kailangan Cloud Functions = Blaze plan. Hindi ma-deploy ang `functions/` sa Vercel. Kapag nag-upgrade, i-deploy pa rin sa Firebase: `npx firebase-tools deploy --only functions` |
| **Viber notifications** | ⚠️ Client-side pa rin (exposed token) — kung i-enable sa production, i-secure via Cloud Function o ASP.NET API |
| **App Check** | ⚠️ Kailangan Blaze — ang pinaka-epektibong proteksyon laban sa script abuse |

---

## 🔁 Ang buong sequence sa isang tingin

```
1. I-disable demo accounts + console settings (Step 0)
2. firebase deploy --only firestore:rules (Step 1)
3. Gumawa ng vercel.json (Step 2)
4. Env variables sa Vercel (Step 3)
5. Import + Deploy sa Vercel (Step 4)
6. Add domain sa Firebase Auth authorized domains (Step 5) ⚠️
7. Custom domain (Step 6)
8. Post-deploy verification (Step 7)
```

**Tapos na! Live na ang system.** Ang natitirang security upgrades (App Check,
server-side Viber/FCM) ay gagawin sa Blaze upgrade o sa ASP.NET migration.
