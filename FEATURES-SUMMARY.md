# Booking System — Feature Summary

**Para sa kliyente:** simple lang ito — kung ano ang kaya ng system, bullet by bullet.

---

## Booking (para sa mga user)
- Pwedeng mag-book ang user ng mga available na **resources** (meeting room, projector, atbp.)
- **Calendar view** — makikita agad kung ilang slots ang available kada araw bago pumili
- **3-step booking** — piliin ang resource, piliin ang petsa at oras, kumpirmahin
- **Walang double-booking** — kung may kumuha na ng slot, hindi na ito makukuha ng iba
- **My Bookings page** — makikita ng user ang lahat ng kanyang bookings (upcoming at history)
- **Pwedeng i-cancel** ng user ang sariling booking
- **Live updates** — kung ma-confirm o ma-cancel ng admin, agad makikita ng user (walang refresh)

## Accounts
- **Sign up / Login** — may account ang bawat user (email + password)
- **2 roles** — Regular User at Admin
- **Demo login buttons** (para sa pag-test)

## Admin Panel
- **Dashboard** — overview ng lahat ng bookings, charts, at statistics
- **Clickable dashboard** — ang bawat numero ay pwedeng i-click para pumunta agad sa listahan
- **Manage bookings** — i-confirm, i-complete, i-cancel, o i-delete ang bookings
- **Pending approvals** — makikita agad ang mga booking na naghihintay ng approval, pwedeng i-confirm o i-decline nang direkta
- **Notification bell** — may live na bilang ng pending approvals; may alert kapag may bagong booking na dumating
- **Manage resources** — magdagdag, mag-edit, o mag-deactivate ng mga bookable resources
- **Search & filter** — hanapin ang bookings ayon sa resource, status, o pangalan

## Dynamic Branding (walang code change)
- **Logo** — pwedeng i-upload ng admin, kasama ang laki (width/height)
- **Colors** — pwedeng baguhin ang primary color, background, at accent color
- **App name** — pwedeng palitan
- **Agad na nag-a-apply** — kapag na-save, agad makikita ng lahat (walang redeploy)

## Maintenance Mode
- **On/Off switch** — isang click lang para i-block ang mga regular user
- **Custom message** — pwedeng isulat ng admin kung anong message ang ipapakita
- Hindi naa-block ang admin (para ma-off nila ang mode)

## Mobile / PWA
- **Installable sa phone** — pwedeng i-add sa home screen ng phone (gumagana tulad ng app)
- **Offline-ready** — may basic offline support
- **Responsive** — gumagana sa phone, tablet, at desktop

## Theme & Design
- **Light / Dark mode** — pwedeng i-toggle ng user
- **Facebook-style header** — profile menu na may avatar, role, at theme switcher
- **Modern dashboard design** — KPI cards, charts, at bento-style layout

## Performance & Polish
- **Mabilis ang first load** — code-splitting (hindi lahat ng libraries ay dina-download agad)
- **Skeleton loaders** — magandang loading state imbes na blank page
- **Micro-animations** — subtle effects na may reduced-motion support
- **Search at filters** sa lahat ng listahan

---

*Para sa karagdagang tanong, i-contact lang kami. Salamat!*
