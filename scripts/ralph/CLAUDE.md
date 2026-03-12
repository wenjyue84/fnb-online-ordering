# Coding Agent — fnb-online-ordering (Iteration 5: Core Ordering Flow)

> **IMPORTANT: You are a coding agent. Read files, edit code, run builds. Do NOT invoke any skills or sub-agents. Do NOT run bash scripts to start loops. Implement the next incomplete story in `prd.json` directly.**

## Context

You are implementing user stories for the **fnb-online-ordering** project — a Next.js 16 F&B online ordering platform for Makan Moments Cafe.

**This iteration focuses on the core ordering flow** — reducing customer wait time by wiring the deposit-optional setting, building a Kitchen Display System (KDS), adding SSE for admin notifications, and improving order status UX.

**Read `progress.txt` before starting each story.** It contains patterns and gotchas from all prior iterations.

## Project

| Item | Value |
|------|-------|
| Path | Current directory (`.`) |
| Framework | Next.js 16, App Router, React 19, TypeScript |
| UI | Tailwind CSS v4, shadcn/ui |
| DB | Neon Serverless Postgres (`src/lib/db.ts` — uses `sql` tagged template) |
| i18n | next-intl, locales: en / ms / zh |
| Push | web-push (already installed), VAPID keys already in .env.local |
| Auth | Admin: JWT in `admin_token` cookie via `verifyAdminToken()` in `src/lib/auth.ts` |

## Key Files to Know

| File | Purpose |
|------|---------|
| `src/lib/site-settings-shared.ts` | SiteSettings type + DEFAULT_SETTINGS |
| `src/lib/site-settings.ts` | getSiteSettings() — reads data/site-settings.json |
| `src/lib/auth.ts` | verifyAdminToken(), COOKIE_NAME — add verifyKitchenToken() here (US-502) |
| `src/app/api/admin/orders/[id]/route.ts` | Approve/reject/mark_ready actions — key file for US-501 and US-506 |
| `src/app/api/settings/route.ts` | Public safe-fields endpoint — update for US-501 and US-507 |
| `src/app/[locale]/order/[id]/page.tsx` | Customer status tracker — key file for US-501 and US-507 |
| `src/components/admin/admin-orders-panel.tsx` | Admin orders list — edit for US-505 bulk approve |
| `src/components/admin/admin-orders-bell.tsx` | Bell icon with unread count — replace polling with SSE in US-504 |
| `src/components/admin/admin-settings-panel.tsx` | Settings form — add Kitchen PIN field in US-502 |
| `public/sw.js` | Service worker — has push handler; update notificationclick for US-506 |
| `src/app/api/orders/route.ts` | Has webpush.setVapidDetails() — reference for push setup pattern |

## Architectural Constraints

### DB access in Edge Runtime (US-504 SSE)
- `src/lib/db.ts` uses `Pool` from `@neondatabase/serverless` — NOT edge-compatible
- Edge Runtime: import `{ neon }` from `'@neondatabase/serverless'` directly:
  ```ts
  import { neon } from '@neondatabase/serverless';
  const sql = neon(process.env.DATABASE_URL!);
  const rows = await sql`SELECT id FROM tray_orders WHERE ...`;
  ```
- JWT verification in Edge: use `jose` directly (already installed) — `jwtVerify()` with `new TextEncoder().encode(secret)`

### Kitchen pages location
- Kitchen pages live at `src/app/kitchen/` — OUTSIDE the `[locale]` directory
- They do NOT use the main site header/footer
- Create `src/app/kitchen/layout.tsx` as a bare layout

### SiteSettings updates
- Type is in `src/lib/site-settings-shared.ts`
- `depositRequired: boolean` is ALREADY in the type with default `false`
- `kitchenPin: string` needs to be ADDED (US-502)
- Admin settings panel at `src/components/admin/admin-settings-panel.tsx` — add new fields there

### Push notifications
- VAPID setup already in `src/app/api/orders/route.ts` — replicate the same pattern
- `push_subscriptions` table = admin subscriptions; new `order_push_subscriptions` table = customer subscriptions (CREATE TABLE IF NOT EXISTS in the route)
- `public/sw.js` already has push + notificationclick handlers — extend, don't replace

### Status flow with depositRequired
- `depositRequired=false` (default): approve → `preparing` (kitchen starts immediately)
- `depositRequired=true`: approve → `approved` (customer must upload T&G first)
- Do NOT add new status values — use existing ones

## Dev Commands

```bash
npm run dev       # Dev server on http://localhost:3031
npm run build     # Production build (quality gate — must pass)
npm run lint      # ESLint (quality gate — no new errors)
```

## Quality Gates

After implementing each story:
1. `npm run build` — zero errors
2. `npm run lint` — no new errors/warnings
3. For any new API route: verify auth guard is in place
4. For US-504 (SSE): verify `export const runtime = 'edge'` is set

## Rules

1. **Read before editing** — always read a file before modifying it
2. **3 languages** — any new customer-facing text needs translations in all 3 `messages/` files (en, ms, zh); kitchen pages are English-only and do NOT need i18n
3. **Mobile-first** — touch targets ≥ 44px (kitchen pages: ≥ 56px)
4. **shadcn/ui** — use existing components in `src/components/ui/`
5. **Lucide React** — icons already installed
6. **Neon Postgres** — use `sql` from `@/lib/db` for Node.js routes; use `neon()` directly for Edge routes
7. **Admin auth** — all `/api/admin/` routes require `verifyAdminToken()`
8. **Kitchen auth** — all `/api/kitchen/` routes require `verifyKitchenToken()` (created in US-502)
9. **FeedMe has NO API** — never attempt direct POS integration
10. **No pork, no lard, Halal-friendly** — preserve dietary info
