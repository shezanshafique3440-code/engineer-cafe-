# Engineer Cafe ☕

> Chai. Paratha. Aur Engineering Wali Vibes.

A production-ready ordering platform for a Pakistani chai & paratha cafe — full storefront,
customer accounts, cart, checkout, order tracking and a complete admin panel. Every price,
discount and total is calculated on the server; the menu is entirely database-driven.

---

## Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 15 (App Router) + React 19 + TypeScript |
| Styling | Tailwind CSS 3 with a custom cafe design system |
| Animation | Framer Motion (respects `prefers-reduced-motion`) |
| Database | PostgreSQL + Prisma ORM (migrations + seed) |
| Auth | JWT sessions in `httpOnly` cookies (`jose`) + bcrypt, role-based access |
| Validation | Zod, shared between client forms and API routes |
| Charts | Recharts |
| Backend | Next.js Route Handlers — one deployable, no duplicated API server |

---

## Quick start

```bash
# 1. Install
npm install

# 2. Configure
cp .env.example .env          # then fill in DATABASE_URL, AUTH_SECRET, seed credentials

# 3. Create the schema
npm run db:migrate            # or: npm run db:deploy  (production)

# 4. Load the menu (74 items, 7 categories, add-ons, coupons)
npm run db:seed

# 5. Run
npm run dev                   # http://localhost:3000
```

Seed accounts are created from `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` and
`SEED_CUSTOMER_EMAIL` / `SEED_CUSTOMER_PASSWORD` in your `.env` — **no credentials are
hardcoded anywhere in the source**. Sign in to the admin panel at `/admin/login`.

### Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Development server |
| `npm run build` | Prisma generate + production build |
| `npm start` | Serve the production build |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint (Next core-web-vitals + TypeScript) |
| `npm run db:migrate` | Create/apply a dev migration |
| `npm run db:deploy` | Apply migrations in production |
| `npm run db:seed` | Seed categories, products, add-ons, coupons, users |

---

## Architecture

```
src/
├── app/
│   ├── (site)/            Public storefront (own layout: navbar, footer, cart, bottom nav)
│   │   ├── page.tsx           Home — hero, categories, rails, deals, reviews, location, CTA
│   │   ├── menu/              Menu, /menu/[category], /menu/[category]/[slug]
│   │   ├── cart/  checkout/   Cart and checkout
│   │   ├── orders/[id]/       Order confirmation + live tracking
│   │   ├── account/           Customer dashboard, orders, favorites, addresses, settings
│   │   ├── about/  contact/   Story and contact form
│   │   └── login/ register/
│   ├── admin/             Admin panel (own layout + sidebar shell)
│   ├── api/               Route handlers — public, customer and /api/admin/*
│   ├── sitemap.ts robots.ts   SEO
│   └── error.tsx not-found.tsx
├── components/
│   ├── ui/                Button, Input, Select, Badge, Rating, EmptyState, ErrorState…
│   ├── layout/            Navbar, Footer, WhatsApp FAB, mobile bottom nav
│   ├── home/              Homepage sections
│   ├── menu/              Product card, customisation dialog, detail view, search, browser
│   ├── cart/              Cart, checkout, order tracker, sticky mobile bar
│   ├── account/           Customer dashboard components
│   └── admin/             Dashboard, managers, shared admin UI
├── context/               Session, settings, cart and favorites providers
├── lib/                   env, prisma, utils, validation (Zod), types, constants, SEO
├── server/                Server-only: auth, api helpers, pricing, orders, products,
│                          settings, storage adapters, rate limiting
└── middleware.ts          Edge gate for /admin and /account
```

### Where the money is calculated

`src/server/pricing.ts` is the single source of truth. The browser only ever sends
**product ids, add-on ids and quantities**. The server then:

1. Re-reads every product price and add-on price from the database.
2. Rejects add-ons that don't belong to the product, and enforces each group's
   selection rules (e.g. exactly one sugar level).
3. Checks availability and stock.
4. Validates the coupon — active, in date, under its usage cap, above its minimum,
   within the customer's per-user limit — and applies any max-discount cap.
5. Applies the delivery fee, free-delivery threshold and tax from admin settings.

`/api/cart/quote` and `/api/orders` both run this same function, so what the cart shows
and what the order stores can never diverge. Frontend prices are never trusted.

---

## Security

- Passwords hashed with bcrypt (cost 12); login returns one message for both unknown
  email and wrong password, so accounts can't be enumerated.
- Sessions are signed JWTs in `httpOnly`, `sameSite=lax`, `secure`-in-production cookies.
- `getCurrentUser()` re-checks the user against the database on every privileged request,
  so a deactivated account or a role change takes effect immediately.
- Middleware gates `/admin` and `/account`; **every** admin route handler independently
  calls `requireAdmin()` — the edge check is defence in depth, not the control.
- Rate limiting on login, register, checkout, coupons, reviews, contact and uploads.
- All input validated with Zod schemas; errors return field-level messages.
- Database errors and stack traces are logged server-side and never returned to users.
- Security headers (`X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`,
  `Permissions-Policy`) set in `next.config.ts`.
- Server-side price and coupon calculation (see above).
- The last active admin cannot be demoted or deactivated.

---

## Image uploads

Images are uploaded through `/api/admin/upload`, which routes to a storage adapter chosen
by `UPLOAD_PROVIDER`:

- `local` — writes to `public/uploads` (git-ignored). Good for a single VPS.
- `cloudinary` — set `CLOUDINARY_CLOUD_NAME` plus either
  `CLOUDINARY_UPLOAD_PRESET` (unsigned, simplest) or
  `CLOUDINARY_API_KEY` + `CLOUDINARY_API_SECRET` (signed). A refusal from
  Cloudinary is logged with its own message, so "Invalid Signature" or
  "Upload preset not found" shows up in the server logs rather than a
  generic failure.
- `s3` — SigV4-signed PUT, works with AWS S3, Cloudflare R2, MinIO and DigitalOcean Spaces.

Adding another provider means implementing one `StorageAdapter` in `src/server/storage.ts`.
Uploaded images are never committed into the frontend source.

## Theming

The cafe picks its palette in **Admin → Settings → Theme**. Six ship today:
Chai (default), Midnight (dark), Matcha, Saffron, Gulabi and Graphite.

Every colour in `tailwind.config.ts` resolves through a CSS variable
(`rgb(var(--c-chai-500) / <alpha-value>)`), and a theme is just a block of RGB
triplets in `globals.css` under `[data-theme="…"]`. That is the whole mechanism:
adding a seventh theme means adding one block there and one entry in
`src/lib/themes.ts` — no component changes, no rebuild of anything else.

Scale semantics every theme must honour:

| Scale | Role |
|---|---|
| `cream` 50 → 400 | page background, panels, borders (light → heavier) |
| `charcoal` 50 → 900 | text, faint → strongest; 900 is the headline colour |
| `chai` 50 → 900 | the brand accent |
| `surface` | cards and inputs, sitting on top of `cream` |

The dark themes invert the `cream` and `charcoal` scales rather than renaming
them, which is what lets the same utility classes work in both. Cards use
`bg-surface`, not `bg-white`; plain `text-white` is left alone because it only
ever sits on a saturated accent, where light text is right in every theme.

**No flash.** The root layout renders `data-theme` on `<html>` from the database,
so the first paint is already correct — there is no client-side theme swap to
see. Saving settings calls `revalidatePath("/", "layout")` so the storefront
picks up a new palette immediately rather than waiting out the 60s window.

**Live preview.** Clicking a theme in admin repaints the panel straight away
without saving; navigating away restores the stored one.

### Visitor appearance

Separately from the cafe's palette, a visitor can choose Light / System / Dark
from the navbar. "Light" is whatever the cafe chose, "Dark" is Midnight, and
"System" follows the device. The choice is stored in `localStorage` and applied
by a blocking inline script in `<head>` before first paint, so a returning
visitor never sees a flash of the light palette. The control hides itself when
the cafe's own theme is already dark — there is nothing to switch between.

---

## The homepage hero

The hero image rotates through every product marked **Featured** in
Admin → Products, best seller first, capped at `HERO_HIGHLIGHT_LIMIT` (6) so a
cafe that features half the menu does not push a dozen photographs into the
first paint.

- **No featured products** → falls back to the genuine best seller.
- **One** → a still image, exactly as before; no dots, no rotation.
- **Two or more** → crossfades every 5s with dots to jump between them.

Rotation pauses on hover, on keyboard focus, and while the tab is in the
background. A visitor with `prefers-reduced-motion` gets no auto-advance at all,
but keeps the dots so the other dishes stay reachable. Every featured image
stays mounted and crossfades on opacity, so a rotation never shows an empty
frame while the next photo downloads.

---

## The order slip

`src/lib/receipt.ts` builds the printed slip. It is sized for an 80mm thermal
roll — what a cafe counter actually has — but prints cleanly to A4 or
"Save as PDF" too.

It carries the cafe's logo, the order number set large enough to read across a
counter, order-type and status badges, the customer and address, per-item
add-ons and notes, the full price breakdown, a payment line stamped PAID or DUE,
and a QR code the customer scans to open the live tracking page.

Deliberately monochrome: thermal heads are single-colour, and on an inkjet a
coloured slip only costs the cafe money. Weight, rules and spacing carry the
hierarchy instead.

Two details worth knowing before editing it:

- The slip is written into a blank popup, which has **no base URL of its own**,
  so a relative `logoUrl` is made absolute against the origin first — otherwise
  the logo silently fails to load.
- The tagline is not uppercased or letter-spaced, because it is often Urdu and
  both mangle it.

The module is loaded with a dynamic `import()` on the first print, keeping the
QR encoder off the orders page's first load (6.8 kB instead of 17.9 kB).


### Printing at the counter

The confirmation screen a customer lands on after placing an order carries a
**Print receipt** button, so a walk-in can be handed a slip before they leave
the counter. The same button sits in the sidebar of the order page for any
later visit.

Both print the real 80mm slip through `buildReceiptHtml`, opened in a blank
window. The button used to call `window.print()`, which put the navbar, the
footer and the page's own buttons on the paper — worth remembering if anyone
is tempted to add another print control.

---

## Order notifications

The cafe has no SMS gateway and no WhatsApp Business API subscription, so notifications are
built as pre-written `wa.me` deep links that staff send with one tap. No paid integration, no
per-message cost, and the update lands on the app the customer already has open.

| Where | What happens |
|---|---|
| Any admin page | A new order plays a two-tone chime and raises a toast. The bell in the header carries the pending count and mutes the sound (`localStorage`). |
| Orders table | A WhatsApp button per row opens a chat with the message for that order's *current* status. |
| Status change | The confirmation toast carries a **Send** action that opens WhatsApp with the message for the *new* status. |
| Order detail | A `WhatsApp: <status>` button alongside Print. |

Message bodies live in `src/lib/notifications.ts`, one per `OrderStatus`, written in the same
Roman Urdu register as the storefront and including the item list, total and a tracking link.
`toWhatsAppNumber()` normalises Pakistani numbers (`03001234567`, `+92 300-1234567`,
`3001234567` all become `923001234567`) and returns `null` for anything undialable, so the
button is disabled rather than opening a broken chat.

The admin shell polls `GET /api/admin/orders/pulse` every 20s — two indexed reads, deliberately
separate from the much heavier dashboard stats endpoint. The first poll only takes a baseline,
so opening the panel never announces orders that were already there.

To upgrade to automatic sends later, call a provider from `transitionOrder()` in
`src/server/orders.ts`; the message builders are pure functions and can be reused as-is.

---

## Payments

`CASH_ON_DELIVERY` and `CASH_AT_COUNTER` work out of the box and are toggled from admin
settings. Online payment is wired through the same order pipeline but stays disabled until
`onlinePaymentEnabled` is switched on and a provider is configured via `PAYMENT_PROVIDER` /
`PAYMENT_SECRET` — the order model already carries `paymentStatus` and `paymentRef`.

---

## Deployment

### Vercel (recommended)

1. Push the repo and import it in Vercel.
2. Set the environment variables from `.env.example` (managed Postgres such as Neon,
   Supabase or Vercel Postgres for `DATABASE_URL`).
3. Build command `npm run build` (runs `prisma generate` first).
4. Run `npm run db:deploy && npm run db:seed` once against the production database.
5. Set `UPLOAD_PROVIDER` to `cloudinary` or `s3` — Vercel's filesystem is ephemeral,
   so `local` will not persist there.

### Render (one-click, database included)

`render.yaml` in the repo root is a Blueprint that provisions the PostgreSQL
database and the web service together.

`render.yaml` deliberately does **not** create the database: Render permits
only one free-tier PostgreSQL per account, so a `databases:` block fails with
*"cannot have more than one active free tier database"* for anyone who already
has one. Bring your own instead.

1. Create a PostgreSQL database — [Neon](https://neon.com) is free and, unlike
   Render's free tier, does not expire after 30 days. Copy its connection
   string (include `?sslmode=require`).
2. Render → **New → Blueprint**, pick this repository and branch.
3. Render prompts for the values marked `sync: false` — paste the connection
   string into `DATABASE_URL`, then set `SEED_ADMIN_EMAIL`,
   `SEED_ADMIN_PASSWORD`, `SEED_CUSTOMER_EMAIL`, `SEED_CUSTOMER_PASSWORD` and
   `WHATSAPP_NUMBER`. `AUTH_SECRET` and `JWT_SECRET` are generated by Render.
4. Apply. The build runs `prisma migrate deploy`, seeds the menu **only while
   the database is still empty** (`SEED_ONLY_IF_EMPTY`), then builds the app —
   so redeploys never overwrite prices edited from the admin panel.
5. Sign in at `/admin/login` with the admin credentials you entered.

Give this app a database of its own. Its migration creates tables in the
`public` schema, so pointing it at a `?schema=` inside a database another
project already uses puts the tables and Prisma's migration table in different
places and the app fails at runtime.

One caveat on Render's free tier: a free web service sleeps after inactivity,
so the first request is slow. Set
`UPLOAD_PROVIDER=cloudinary` (with the `CLOUDINARY_*` keys) before uploading
product photos — Render's disk is ephemeral and `local` uploads would be lost
on redeploy.

### VPS / Docker

```bash
npm ci
npm run db:deploy
npm run build
npm start          # behind nginx/caddy, or under pm2/systemd
```

`local` uploads work here; keep `public/uploads` on a persistent volume.

---

## The menu

The seed carries Engineer Cafe's actual printed menu — 35 items, transcribed
from the menu board with their real prices. Every item stores its Urdu name
alongside the English one, and both are shown on the menu.

| Category | Items | Price range |
|---|---|---|
| Chai (چائے) | 9 — sada, gur wali, kettli, badam, kashmiri, sulemani/sabz/doodh qehwa, coffee | Rs. 80 – 200 |
| Parathas (پراٹھے) | 16 — lachha, khushk, aloo, desi ghee, cheese, anda pizza, chicken, roll parathay | Rs. 80 – 360 |
| Anday (انڈے) | 5 — half fry, full fry, omelette, tamatar, cheese | Rs. 80 – 130 |
| Sides & Extras | 5 — Shakeel Lahori chanay, malai plate, disposable charges | Rs. 10 – 300 |

### Menu art

Every dish has its own illustration in `public/menu` — 27 hand-drawn SVGs, one
per item type, shipped inside the repo. Nothing depends on an outside image
host, so no picture can 404 later, and the art is themed to match the site
rather than showing another cafe's food. Swap any of them for a real photograph
from Admin → Products whenever the cafe has one; on Render, set
`UPLOAD_PROVIDER=cloudinary` first so uploads survive a redeploy.

Serving these needs `images.dangerouslyAllowSVG` in `next.config.ts`. The flag
exists because a hostile SVG can carry script; the `contentSecurityPolicy` set
alongside it (`script-src 'none'; sandbox;`) removes that capability, which is
the configuration Next documents for trusted SVG.

Where the board printed two prices on one line (`170/220`, `100/200`,
`180/300`) the item is seeded as two products so both prices stay editable from
Admin → Products.

**Not seeded, because the price was unreadable on the menu photo:** Cold Drinks
(کولڈ ڈرنکس), Sting (سٹنگ ڈرنکس), Mineral Water (منرل واٹر) and Special Lassi
Glass (اسپیشل لسی گلاس). Add them from Admin → Products once the prices are
confirmed — no price is ever guessed here.

Add-on options (sugar level, strength, paratha and egg style) are all priced at
zero, because the board does not charge for them. `npm run db:seed` makes the
database match `prisma/seed-data.ts`: items no longer on the menu are deleted,
or hidden instead of deleted when they already appear in an order.

Sample coupons `ENGINEER10`, `STUDENT15` and `FIRSTBREW` are starting points,
not the cafe's policy — edit or switch them off in Admin → Coupons.

## Known issue

A menu URL that does not exist (`/menu/no-such-category`) renders the 404 page
but responds with HTTP 200 instead of 404 — a soft 404. It comes from
`notFound()` inside a statically generated route in Next 15.5; forcing dynamic
rendering and adding a route-group `not-found.tsx` both failed to change the
status. Those pages already send `robots: noindex`, so they are not indexed,
but the status code is still wrong. Unmatched routes outside `/menu`
(`/no-such-page`) return a correct 404.

## Accessibility & performance

- Keyboard-navigable throughout; skip link, focus-visible rings, `aria-*` on dialogs,
  tabs, radio groups and live regions.
- Every image has meaningful alt text; decorative images are `aria-hidden`.
- Skeleton loaders, empty states, error states and success toasts for every async surface.
- `next/font` with `display: swap`; `next/image` with AVIF/WebP and lazy loading below the fold.
- Static generation for the homepage, menu and every product page; dynamic rendering only
  where a session is involved.
- Mobile-first, no horizontal scrolling at any breakpoint.
