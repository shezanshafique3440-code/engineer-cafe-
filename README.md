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
- `cloudinary` — signed REST upload; set `CLOUDINARY_*`.
- `s3` — SigV4-signed PUT, works with AWS S3, Cloudflare R2, MinIO and DigitalOcean Spaces.

Adding another provider means implementing one `StorageAdapter` in `src/server/storage.ts`.
Uploaded images are never committed into the frontend source.

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

## Seeded menu

74 items across 7 categories, at realistic Pakistani prices:

| Category | Items |
|---|---|
| Chai | 20 — doodh patti, karak, kashmiri, masala, qehwa, kettles… |
| Parathas | 20 — aloo, cheese, egg, chicken, qeema, nutella, loaded… |
| Snacks | 10 — fries, samosas, wings, pakoras, garlic bread |
| Burgers & Sandwiches | 5 |
| Cold Drinks | 10 — water, soft drinks, shakes, lassi, doodh soda |
| Combos | 5 — Student Deal, Engineer Combo, Late Night Debugging Deal… |
| Desserts | 4 |

Add-on groups (sugar level, milk, strength, paratha size, paratha add-ons, dips) each carry
their own prices and selection rules, all editable from the admin panel.

Sample coupons: `ENGINEER10`, `CHAI20`, `STUDENT15`, `FIRSTBREW`, `LATENIGHT`.

---

## Accessibility & performance

- Keyboard-navigable throughout; skip link, focus-visible rings, `aria-*` on dialogs,
  tabs, radio groups and live regions.
- Every image has meaningful alt text; decorative images are `aria-hidden`.
- Skeleton loaders, empty states, error states and success toasts for every async surface.
- `next/font` with `display: swap`; `next/image` with AVIF/WebP and lazy loading below the fold.
- Static generation for the homepage, menu and every product page; dynamic rendering only
  where a session is involved.
- Mobile-first, no horizontal scrolling at any breakpoint.
