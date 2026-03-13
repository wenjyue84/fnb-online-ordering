# CLAUDE.md — F&B Online Ordering Platform

> **Project:** fnb-online-ordering — Generic F&B online ordering platform with multilingual support, Neon Postgres, and AI waiter chatbot. Cloned from makanmoments.cafe and decoupled for independent deployment.

## Project Overview

Public-facing website for **Makan Moments Cafe** (食光记忆 / Kafe Kenangan Makan), located in Taman Impian Emas, Skudai, Johor, Malaysia.

**Live site:** TBD (not yet deployed)
**Deploy:** Vercel (`.vercel/` config present)

### Pre-Order System

Customers can pre-order food online before arriving at the cafe. **FeedMe POS has no API** — there is intentionally no direct integration. The workflow is:

1. **Customer** browses menu → adds items → submits pre-order with name, phone, arrival time, pax count, and notes
2. **System** saves order to Neon Postgres (`orders` table) and sends WhatsApp notification to the waiter's phone
3. **Waiter** receives WhatsApp message with full order details → manually types the order into FeedMe POS before the customer arrives
4. **Customer** arrives to find their meal being prepared or ready

This human-in-the-loop design is deliberate: FeedMe handles payments and receipts; the website handles intake and routing.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router) |
| UI | React 19, Tailwind CSS v4, shadcn/ui |
| Language | TypeScript 5 |
| i18n | next-intl (EN / MS / ZH, always-prefixed) |
| Database | Neon Serverless Postgres (`src/lib/db.ts`) |
| AI Chat | Vercel AI SDK + Groq / OpenRouter |
| Icons | Lucide React |
| Sitemap | next-sitemap |

## Project Structure

```
fnb-online-ordering/
├── src/
│   ├── app/
│   │   ├── [locale]/                    # All public pages (locale-prefixed)
│   │   │   ├── page.tsx                 # Home
│   │   │   ├── menu/page.tsx            # Menu listing
│   │   │   ├── order/[id]/
│   │   │   │   ├── page.tsx             # Customer order status tracker (polls /api/orders/[id])
│   │   │   │   └── payment/page.tsx     # T&G payment upload step
│   │   │   ├── blog/                    # Blog listing + slug pages
│   │   │   ├── about/page.tsx
│   │   │   └── contact/page.tsx
│   │   ├── admin/
│   │   │   ├── page.tsx                 # Admin dashboard (auth-gated)
│   │   │   └── login/page.tsx
│   │   ├── api/
│   │   │   ├── chat/route.ts            # AI waiter chat endpoint (streaming)
│   │   │   ├── settings/route.ts        # GET /api/settings — public safe settings (tngPhone, tngQrUrl)
│   │   │   ├── orders/
│   │   │   │   ├── route.ts             # POST /api/orders — submit pre-order
│   │   │   │   └── [id]/
│   │   │   │       ├── route.ts         # GET /api/orders/[id] — status check (no auth)
│   │   │   │       └── payment/route.ts # POST /api/orders/[id]/payment — upload T&G screenshot
│   │   │   └── admin/
│   │   │       ├── orders/route.ts      # GET/PATCH admin orders (approve/reject/update status)
│   │   │       ├── settings/route.ts    # GET/POST admin settings (all fields)
│   │   │       ├── menu/[id]/route.ts   # PATCH menu item
│   │   │       ├── images/route.ts      # POST image upload
│   │   │       ├── highlights/route.ts  # GET/POST category highlights
│   │   │       ├── rules/route.ts       # GET/POST/DELETE availability rules
│   │   │       └── display-categories/  # Display category management
│   │   ├── layout.tsx                   # Root layout
│   │   └── globals.css                  # Global styles (Tailwind)
│   ├── components/
│   │   ├── admin/                       # admin-tabs, admin-menu-table, admin-orders-panel,
│   │   │                                #   admin-settings-panel, admin-rules-panel, admin-tests-panel,
│   │   │                                #   admin-operating-hours, admin-time-settings, admin-orders-bell,
│   │   │                                #   image-picker-modal, editable-menu-card, chat-settings-panel
│   │   ├── blog/                        # post-card, post-content
│   │   ├── chat/                        # chat-bubble, chat-panel, chat-widget
│   │   ├── home/                        # hero-section, highlights, info-strip
│   │   ├── layout/                      # header, footer, theme-toggle
│   │   ├── menu/                        # menu-card, menu-filter, menu-grid, dietary-badge,
│   │   │                                #   tray-widget, tray-button, chef-pick-card, editable-menu-card
│   │   ├── seo/                         # json-ld
│   │   └── ui/                          # shadcn/ui primitives (button, etc.)
│   ├── i18n/
│   │   ├── routing.ts                   # Locales: ["en", "ms", "zh"], defaultLocale: "en"
│   │   ├── navigation.ts                # Typed Link/redirect helpers
│   │   └── request.ts                   # next-intl config entrypoint
│   ├── lib/
│   │   ├── constants.ts                 # CAFE info, MENU_CATEGORIES
│   │   ├── db.ts                        # Neon Serverless Postgres client singleton
│   │   ├── menu.ts                      # Menu data fetching (with display categories + rules)
│   │   ├── blog.ts                      # Blog data fetching
│   │   ├── rules.ts                     # Availability rules (getActiveRules, applyRules)
│   │   ├── availability.ts              # filterByAvailability, getOperatingStatus
│   │   ├── highlights.ts                # Category highlight management
│   │   ├── site-settings.ts             # getSiteSettings() — reads data/site-settings.json
│   │   ├── time-slots.ts                # getDefaultCategoryForTime, getServingNowCategories
│   │   ├── tray-context.tsx             # TrayProvider — cart state (items, addItem, clearTray)
│   │   ├── auth.ts                      # verifyAdminToken, COOKIE_NAME
│   │   ├── utils.ts                     # cn() and helpers
│   │   └── chat/
│   │       ├── provider.ts              # AI SDK model config (Groq/OpenRouter)
│   │       ├── rate-limit.ts            # Per-IP rate limiting
│   │       └── system-prompt.ts         # Loads knowledge/ files into AI system prompt
│   └── types/
│       ├── menu.ts                      # MenuItem, MenuItemWithRules, DisplayCategory
│       └── blog.ts                      # BlogPost types
├── data/                                # JSON config files (server-side, not committed to git if sensitive)
│   ├── site-settings.json               # Operating hours, T&G phone/QR, pre-order toggle, currency
│   ├── operating-hours.json             # Daily open/close times
│   ├── time-slots.json                  # Time-based default category config
│   └── chat-settings.json               # AI waiter system prompt + model config
├── knowledge/                           # AI waiter knowledge base (markdown)
│   ├── cafe-facts.md                    # Hours, address, WiFi, ambiance, featured items
│   ├── menu-knowledge.md                # Full menu with prices for AI context
│   └── faq.md                           # Frequently asked questions
├── messages/                            # i18n translation files
│   ├── en.json
│   ├── ms.json
│   └── zh.json
├── public/                              # Static assets
│   └── images/menu/{code}.jpg           # Menu item photos (named by item code)
├── scripts/                             # Utility and migration scripts
├── middleware.ts                        # next-intl locale detection
├── next.config.ts                       # Turbopack + next-intl plugin
├── components.json                      # shadcn/ui config
├── .env.local                           # Local env vars (not committed)
└── .env.example                         # Env var template
```

## Dev Commands

```bash
npm run dev       # Start dev server on http://localhost:3031 — PORT LOCKED: always use 3031, do NOT change
npm run build     # Production build + generates sitemap (postbuild)
npm run start     # Serve production build
npm run lint      # ESLint check
```

> **PORT 3031 — LOCKED.** Dev server runs on http://localhost:3031 (confirmed working).
> Navigate to http://localhost:3031/en (middleware redirects / → /en automatically).
> Do NOT change this port unless explicitly instructed.

## Environment Variables

See `.env.example` for all required vars:

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | Neon Serverless Postgres connection string |
| `ADMIN_USERNAME` | Admin panel login username |
| `ADMIN_PASSWORD` | Admin panel login password |
| `ADMIN_JWT_SECRET` | JWT signing secret (≥ 32 chars) |
| `GROQ_API_KEY` | Groq API key for AI waiter |
| `OPENROUTER_API_KEY` | OpenRouter fallback for AI waiter |
| `NEXT_PUBLIC_SITE_URL` | Production URL (set to deployment domain) |
| `NEXT_PUBLIC_WHATSAPP_NUMBER` | Cafe's public WhatsApp CTA number |
| `WAITER_WHATSAPP_NUMBER` | Waiter's number to receive pre-order notifications (e.g. `601XXXXXXXX`) |
| `WHATSAPP_API_URL` | WhatsApp send endpoint (Periskope or Baileys) |
| `WHATSAPP_API_KEY` | API key / token for WhatsApp sender |

## Key Conventions

### Localization
- All page routes live under `src/app/[locale]/`
- Supported locales: `en`, `ms`, `zh` — always prefix in URL (e.g. `/en/menu`)
- Translations in `messages/{locale}.json`
- Use `useTranslations()` in client components, `getTranslations()` in server components

### Data Fetching
- Menu and blog data fetched from **Neon Postgres** via `src/lib/db.ts`
- `src/lib/menu.ts` and `src/lib/blog.ts` wrap SQL queries with typed results
- All DB fetches are server-side (RSC or route handlers)

### Pre-Order System

**6-stage order flow:**

```
Customer builds tray → clicks "Send Order" → modal: contact number + ETA
  → POST /api/orders → status: pending_approval → order ID shown to customer
  → Admin receives notification (AdminOrdersBell) → approves or rejects in /admin > Orders tab
  → On approval → status: approved → customer sees "Awaiting Payment" on /order/[id]
  → Customer goes to /order/[id]/payment → scans T&G QR → uploads screenshot
  → POST /api/orders/[id]/payment → status: payment_uploaded
  → Admin confirms payment receipt → status: preparing
  → Admin marks ready → status: ready → customer notified
  → Customer arrives → food ready
```

**Order status values:**
| Status | Meaning |
|--------|---------|
| `pending_approval` | Submitted, awaiting admin review |
| `approved` | Admin approved, awaiting T&G deposit |
| `payment_pending` | (transitional) |
| `payment_uploaded` | Customer uploaded T&G screenshot |
| `preparing` | Admin confirmed payment, kitchen is preparing |
| `ready` | Order is ready for pickup |
| `rejected` | Admin rejected (with reason) |

**Order submission (customer-facing):**
- Contact number (Malaysian format: 01X-XXXXXXX — validated)
- Estimated arrival time (minimum 15 min from now)
- Items already in tray (from TrayContext)
- Short order ID (nanoid 8 chars) — shown to customer and saved in localStorage

**`orders` table schema (Neon Postgres):**
```sql
CREATE TABLE orders (
  id                    TEXT PRIMARY KEY,        -- nanoid(8), e.g. 'aB3xKq7m'
  items                 JSONB NOT NULL,           -- [{id, nameEn, price, quantity}]
  total                 NUMERIC(8,2) NOT NULL,
  contact_number        TEXT,
  estimated_arrival     TIMESTAMPTZ,
  estimated_ready       TIMESTAMPTZ,
  status                TEXT NOT NULL DEFAULT 'pending_approval',
  rejection_reason      TEXT,
  payment_screenshot_url TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

**T&G Payment config** (stored in `data/site-settings.json`):
- `tngPhone` — T&G registered phone number to display to customer
- `tngQrUrl` — path or URL to T&G QR code image
- Exposed to client via `GET /api/settings` (public, no auth, only safe fields)

**Admin orders management** (`/admin` > Orders tab):
- `AdminOrdersBell` — header bell icon with unread count badge, polls for new orders
- `AdminOrdersPanel` — list of all orders with approve/reject actions and status updates
- `PATCH /api/admin/orders/[id]` — update status, set rejection reason, mark payment confirmed

**Cart / Tray state:** Held in `TrayContext` (client-side, `src/lib/tray-context.tsx`). Tray is cleared after successful order submission. Order history saved to localStorage (`mm_order_history`).

**FeedMe POS — Manual Entry Protocol:**
- FeedMe has **no API** — never attempt programmatic integration
- Waiter enters approved order manually into FeedMe POS before customer arrives
- The pre-order system is for intake and routing only; FeedMe handles payment at the counter

### Admin Panel (`/admin`)

Tabs: **Menu | Categories | Rules | Blog | Tests | Time Settings | Operating Hours | Orders | Settings**

| Tab | Purpose |
|-----|---------|
| Menu | Edit items (price, name, image, dietary, availability, display categories, featured flag) |
| Categories | POS categories (read-only) + Display categories (editable: Chef's Picks, Under RM15, Vegetarian, etc.) |
| Rules | Availability rules — hide/show items by time, date, or category |
| Blog | WYSIWYG blog post editor |
| Tests | Runnable smoke/integration tests |
| Time Settings | Configure time-of-day default category per time slot |
| Operating Hours | Set daily open/close times |
| Orders | View/approve/reject pre-orders, update status, mark payment confirmed |
| Settings | Site-wide config: T&G payment details, pre-order toggle, currency, default locale |

**Admin auth:** JWT cookie (`COOKIE_NAME`). Login at `/admin/login`. Protected by `verifyAdminToken()` in `src/lib/auth.ts`.

**Admin edit mode on /menu:** When admin is logged in, `/en/menu` shows an edit banner. Hovering items shows inline edit controls (price, description, image). Uses `EditableMenuCard` component.

### Site Settings (`data/site-settings.json`)

Persistent config store read by `getSiteSettings()` in `src/lib/site-settings.ts`:
- `tngPhone`, `tngQrUrl` — T&G payment details shown to customers
- `preOrderEnabled` — toggle pre-order system on/off
- `currency` — default "RM"
- `defaultLocale` — for middleware locale redirect
- `operatingHours` — open/lastOrder/close times

Public endpoint: `GET /api/settings` (no auth) — exposes only customer-safe fields.
Admin endpoint: `GET/POST /api/admin/settings` (auth required) — full read/write.

### AI Waiter Chat
- Chat widget floats on every page (injected via `[locale]/layout.tsx`)
- API route: `POST /api/chat` — uses Vercel AI SDK streaming
- System prompt auto-loads all 3 `knowledge/*.md` files at startup (cached in memory)
- To update cafe info/menu for the AI: edit `knowledge/` markdown files directly
- Admin can configure AI model/prompt via `/admin` > AI Settings (stored in `data/chat-settings.json`)
- Rate limiting applied per IP in `src/lib/chat/rate-limit.ts`

### Components
- shadcn/ui for UI primitives (`src/components/ui/`)
- Feature components co-located by domain: `blog/`, `chat/`, `home/`, `menu/`, `layout/`
- `cn()` utility in `src/lib/utils.ts` for conditional Tailwind classes

### Cafe Facts (Single Source of Truth)
- `src/lib/constants.ts` — `CAFE` object with name, address, hours, social links, etc.
- Use this for all on-page references; don't hardcode cafe info in components

### Mobile-First Design
- **Default to mobile viewport** — design at 390px, enhance at sm (640px) and lg (1024px)
- **Touch targets ≥ 44px** — all buttons, links, and interactive elements (use `min-h-[44px]`)
- **Hero section must show visuals on mobile** — no `hidden lg:block` on hero imagery
- **Test on low-end Android + slow 3G** before deploying any UI changes
- **Image priority order:** LCP image on mobile must have `priority` prop
- **No horizontal scroll** — verify at 390px and 414px widths
- **Animations:** Use `prefers-reduced-motion` media query for all animations
- **One CTA above the fold on mobile** — primary action only; secondary CTA hidden on mobile (`hidden sm:inline-flex`)
- **No hover-only interactions** — every hover effect needs a tap equivalent
- **Food images are the product** — show them immediately above the fold on mobile

### Performance (Lightning Fast Landing)
- **LCP target:** < 2.5s on mobile 3G (Lighthouse mobile score ≥ 85)
- **No render-blocking resources** in `<head>`
- **Hero image:** `priority={true}` on mobile LCP image; explicit `sizes` prop on all images
- **Fonts:** `display: "swap"` always; `preload: false` on Noto Sans SC (CJK only loaded for zh locale)
- **ISR on home page:** `revalidate = 3600`
- **No client-side data fetching on home page** — all data server-side (RSC)
- **Image cache:** `minimumCacheTTL: 86400` set in `next.config.ts`
- **Decorative elements:** hide on mobile (`hidden lg:block`) to reduce paint cost
- **Info-strip and similar static display components:** use RSC (`getTranslations`) not client hooks

## Design Context

### Users
Local Johor Bahru residents (families, young professionals, students), plus occasional tourists passing through Skudai. They're on mobile phones, browsing during lunch breaks or while deciding where to eat. The job to be done: quickly feel the vibe, find the menu and prices, and get directions. They want to feel like they've already discovered a gem before they walk in.

### Brand Personality
**Authentic · Cultural · Soulful** — Makan Moments is not just food; it's the story of Thai-Malaysian fusion told through a neighbourhood corner shop. The brand feels like a well-loved place, not a chain. Multilingual identity (English / Bahasa / Chinese) is a feature, not an afterthought. Warmth is the core emotion.

### Aesthetic Direction
**Organic / Earthy** — Warm linen backgrounds, terracotta and amber tones (already defined in OKLCH palette), botanical touches, handcrafted texture. Inspired by editorial food publications from Southeast Asia. References: natural materials, indoor plants (matches real café ambiance), hand-drawn wall art. Anti-references: generic tech startup aesthetics, cyan/purple gradients, glassmorphism, neon-on-dark. Cuisine should be the visual hero — food photography front and centre always.

### Theme
Light mode as default (warm cream background, not pure white — already defined). Dark mode toggle available. Both modes should feel earthy and warm, never cold or blue-tinted.

### Logo
User has a logo image file (PNG/SVG). Place at `public/images/logo.png` (or `.svg`) and update header + footer to use it. Until provided, use bold text wordmark.

### Design Principles
1. **Food first** — every page should make the viewer hungry within 3 seconds
2. **Handcrafted over polished** — slight imperfection, texture, and warmth beats clinical perfection
3. **Mobile = primary** — design at 390px first; desktop is enhancement
4. **Multilingual by default** — typography must work across Latin, Malay, and CJK scripts
5. **Moments, not transactions** — tone is storytelling, not sales; the word "Makan" (eat) and "Moments" imply memory and gathering, lean into that

---

## Critical Rules

1. **Read before editing** — always read a file before modifying it
2. **Neon Postgres is the database** — all persistent data (menu, blog, orders, display categories, rules) lives in Neon; Notion is NOT used
3. **`knowledge/` drives the AI** — updating these files updates what the AI waiter knows
4. **No pork, no lard, Halal-friendly** — always preserve this dietary info accurately
5. **3 languages always** — any new user-facing text needs translations in all 3 `messages/` files
6. **Prices in RM** — all price references use Malaysian Ringgit (RM)
7. **FeedMe has NO API** — never attempt direct POS integration; all order routing goes through the admin panel → manual waiter entry into FeedMe
8. **Pre-order deposit via T&G** — customer uploads a T&G screenshot as deposit; actual payment at the cafe counter via FeedMe POS
9. **Orders go into Neon** — use the `orders` table in the existing `DATABASE_URL` connection; no separate service needed
10. **`data/*.json` are config stores** — site-settings.json, chat-settings.json, operating-hours.json, time-slots.json are server-side only; never expose secrets in them
11. **Admin API routes require auth** — always call `verifyAdminToken()` at the top of any route under `/api/admin/`
12. **Display categories ≠ POS categories** — `categories[]` on items = POS (Rice, Noodles, Drinks); `displayCategories[]` = website-only (Chef's Picks, Vegetarian, Under RM15). Special display categories (Under RM15, Vegetarian, Favorites) are computed client-side from price/dietary, not from the junction table
13. **Menu filter pills = display categories ONLY** — The category filter bar on `/menu` shows ONLY display categories as pills. POS categories are NEVER rendered as customer-facing filter pills; they are internal FeedMe data used for section grouping in the All-items view. See `src/components/menu/menu-filter.tsx` for the enforced comment. Do not add POS category pills back.
