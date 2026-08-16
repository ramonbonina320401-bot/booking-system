# UI/UX Extraction Prompt (reusable)

I-paste ang nasa ibaba sa ibang AI (mas maganda kung may image/vision support).
Palitan ang REFERENCE_URL at i-attach ang screenshot kung meron kang naka-save
na imahe ng design.

---

You are a senior UI/UX design analyst. Analyze the dashboard design at this
reference and produce a complete, actionable UI specification that a developer
can implement in a React 18 + TypeScript + Tailwind CSS 4 app with
shadcn/ui-style components and CSS custom properties.

REFERENCE_URL: https://dribbble.com/shots/26589040-Dashboard-UI-Design-Organization-Analytics-Web-App
(attach the screenshot image if you can view files but not the URL)

## Context about the target app

- It is a booking system with public pages (home, login, booking wizard, "my
  bookings") and an admin area (dashboard with stats/charts/tables, bookings
  manager, resources manager, settings panel).
- Theming is DYNAMIC: brand colors come from a database and are injected as CSS
  custom properties (`--app-primary`, `--app-accent`, `--app-background`).
  Tailwind utilities map to these variables via `@theme inline`.
- The app has a light mode and a dark mode.
- Component library: shadcn/ui style (Radix primitives + cva variants): button,
  card, dialog, select, switch, table, badge, input, textarea, skeleton.
  Charts are rendered with Recharts.
- Current design language: bento-style cards (rounded-2xl, soft layered
  shadows) and a dashboard shell = left sidebar + top header + tinted content
  area.

## Your job

Extract EVERYTHING needed to restyle this app to match the reference as closely
as possible. Be specific and concrete. For every color, give an exact hex code
(estimate by sampling the image). Never write "use the primary color" — give
the actual value.

## Output format (follow this exact structure)

### 1. Color palette (exact hex codes)
- Page background / content background / sidebar background / header background
  / card surface / elevated surface
- Primary / secondary / accent, plus their hover/darker variants
- Text: primary, secondary/muted, disabled, text-on-brand
- Borders, dividers, focus rings
- Status colors: success, warning, danger, info
- Chart palette: 5–8 hex codes for line/area/bar/donut charts
- Gradients: any brand gradients (exact start + end hex)
- Dark mode: repeat the full list. If the reference does not show dark mode,
  propose a dark palette that stays consistent with the design's identity.

### 2. Typography
- Font family (identify by look; if unknown, recommend the closest Google Font)
- Sizes and weights for: page title, section title, card title, KPI number,
  eyebrow/label, table header, table body, button, body text, small/meta text
- Letter-spacing and line-height notes for headings and large numbers

### 3. Layout & spacing
- Sidebar width, header height, content max-width, page padding (desktop +
  mobile)
- Dashboard grid structure: how many columns, which tiles span how many columns
- Gap sizes between cards / rows / columns (in px)
- Card padding, table cell padding, section spacing
- Border radius: cards, buttons, inputs, chips/badges, avatars, tables
- Shadows: card shadow (size, color, opacity), hover/elevated states

### 4. Components & states
- Buttons: primary/secondary/ghost — padding, radius, icon treatment
- Cards: header layout, eyebrow labels, hover behavior, any accent/highlight
  tiles
- Tables: header row style, row height, zebra striping, row hover, status badge
  style (pill? dot + label?)
- Sidebar nav: item height, active state (filled pill? left accent bar? tint?),
  icon style, section labels, user/profile card at the bottom
- Top header: what lives in it (search bar? notifications? avatar?), its style
- Charts: chart card header, axis tick style, gridlines, tooltip style, legend
  style
- Badges, avatars (size, border, initials style), inputs (focus ring), toggles

### 5. Visual style details
- Rounded vs sharp corners, shadows, glassmorphism/blur, border weight, icon
  stroke thickness, any texture or pattern
- The overall mood in 3 words (e.g. "clean, airy, corporate")

### 6. Mapping to our theming system
For each extracted color, state which CSS variable it replaces:
`--app-primary`, `--app-accent`, `--app-background`, `--app-card`,
`--app-muted`, `--app-border`, `--app-foreground`, `--app-success`,
`--app-destructive`, `--app-sidebar`.
Then list which variables should stay dynamic (driven by the database brand
colors) vs hardcoded to the reference palette.

### 7. Component change checklist
A concrete list like:
- [ ] Card radius → 16px, shadow → 0 1px 2px rgba(0,0,0,.04), 0 8px 24px -12px rgba(0,0,0,.12)
- [ ] Sidebar width → 260px, active item = filled pill with 12% primary tint
- [ ] KPI numbers → 32px / weight 700 / tight tracking

## Rules

- If the image is low-res or ambiguous, state what you inferred and flag
  uncertainties with a "(?)" marker.
- Prefer exact px and hex values over vague descriptions.
- The spec must be implementable WITHOUT needing to see the image again.
