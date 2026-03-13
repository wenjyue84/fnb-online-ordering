# Deployment Guide — fnb-online-ordering

This guide covers deploying the F&B Online Ordering platform to Vercel with a Neon Serverless Postgres database.

## Pre-Deployment Checklist

### 1. Database Setup

Before deploying to production, you must seed the Neon database with configuration data.

**Install dependencies** (if not already done):
```bash
npm install
```

**Run the seed script** (one-time operation — safe to re-run):
```bash
node scripts/seed-settings.mjs
```

This migrates all JSON configuration files into the `site_settings` database table:
- `operating_hours` — Cafe operating hours
- `time_slots` — Time-of-day category defaults
- `chat` — AI waiter settings
- `site` — General site settings

**Verify seeding was successful**:
```bash
node scripts/verify-seed.mjs
```

Expected output:
```
Verifying site_settings keys in Neon...
✓ PASS: All 4 settings keys present in DB
```

### 2. Environment Variables

Copy all variables from `.env.example` to your deployment environment. Below is a detailed reference:

| Variable | Purpose | Required | Notes |
|----------|---------|----------|-------|
| `DATABASE_URL` | Neon Postgres connection string | **Yes** | Format: `postgresql://user:pass@host.neon.tech/dbname?sslmode=require` |
| `ADMIN_USERNAME` | Admin panel login username | **Yes** | Used for `/admin/login` |
| `ADMIN_PASSWORD` | Admin panel login password | **Yes** | Keep strong and unique |
| `ADMIN_JWT_SECRET` | JWT signing secret for admin auth | **Yes** | ≥ 32 random characters (use `openssl rand -base64 32`) |
| `NEXT_PUBLIC_SITE_URL` | Public site URL for SEO & metadata | **Yes** | Used in sitemap, JSON-LD schema, Open Graph tags |
| `GROQ_API_KEY` | Groq AI API key for waiter chat | No | Get from https://console.groq.com. Fallback: OpenRouter |
| `OPENROUTER_API_KEY` | OpenRouter API key (fallback AI) | No | Get from https://openrouter.ai. Used if Groq unavailable |
| `NEXT_PUBLIC_WHATSAPP_NUMBER` | Cafe's WhatsApp CTA number | No | Shown in "Contact" CTA. Format: `60<number>` (Malaysian) |
| `WAITER_WHATSAPP_NUMBER` | Waiter's number for order notifications | No | Format: `60<number>`. Required if WhatsApp alerts enabled |
| `WHATSAPP_API_URL` | WhatsApp API endpoint | No | E.g., `https://api.whatsapp.com/send` or Evolution API instance |
| `WHATSAPP_API_KEY` | API key for WhatsApp provider | No | Depends on provider (Periskope, Evolution, etc.) |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | VAPID public key for PWA push | No | Generate with: `node -e "const wp=require('web-push'); console.log(JSON.stringify(wp.generateVAPIDKeys(), null, 2))"` |
| `VAPID_PRIVATE_KEY` | VAPID private key for PWA push | No | **Keep secret.** Pair with public key above |
| `VAPID_SUBJECT` | VAPID subject (mailto: for notifications) | No | Fallback: `mailto:admin@localhost` if not set |
| `KITCHEN_USERNAME` | Kitchen Display System (KDS) login | No | User account for kitchen-facing interface |
| `KITCHEN_PASSWORD` | Kitchen Display System password | No | **Keep strong.** |

### 3. Database Configuration in Neon

1. **Create a new Neon project** at https://neon.tech (free tier available).
2. **Get the connection string**: `postgresql://[user]:[password]@[host]/[dbname]?sslmode=require`
3. **Add to Vercel environment variables** as `DATABASE_URL`.
4. **Run the seed script** from your local machine or CI/CD pipeline to initialize tables and seed data.

## Vercel Deployment Steps

### 1. Connect Repository

1. Go to https://vercel.com/new
2. Select **Import Git Repository**
3. Choose this repository (`fnb-online-ordering`)
4. Click **Import**

### 2. Configure Environment Variables

In the Vercel project settings (**Settings** > **Environment Variables**):

1. Add all variables from the table above
2. Ensure `DATABASE_URL` is set to your Neon connection string
3. Use **Node 20.x** (configured in `.vercel/project.json`)

### 3. Pre-Deployment Hook (Optional)

To seed the database automatically on each deployment:

1. In Vercel project settings, go to **Settings** > **Git**.
2. Add a **Build Command** override (if needed):
   ```bash
   npm run build && node scripts/verify-seed.mjs
   ```

This ensures the database is verified before the deployment finalizes.

### 4. Deploy

1. Push to the `feature/iter-02` (or target) branch.
2. Vercel auto-deploys on push.
3. Monitor deployment progress in Vercel Dashboard.

## Post-Deployment Verification

After deployment:

1. **Check the homepage**: `https://<your-vercel-domain>/en`
2. **Test admin login**: `https://<your-vercel-domain>/admin/login`
3. **Test API endpoints**:
   ```bash
   curl https://<your-vercel-domain>/api/settings
   curl https://<your-vercel-domain>/api/chat (should stream SSE)
   ```

## Notes on Configuration Files

### data/*.json Files (Legacy)

The `data/` directory contains JSON seed sources:
- `site-settings.json`
- `operating-hours.json`
- `time-slots.json`
- `chat-settings.json`

**These files are no longer read at runtime.** They are used only by the `scripts/seed-settings.mjs` script to initialize the database. After seeding, the database (`site_settings` table) is the authoritative source.

**Safe to delete** after confirming seeding is successful via `scripts/verify-seed.mjs`.

## Troubleshooting

### "DATABASE_URL not set"
- Ensure the `DATABASE_URL` environment variable is added to Vercel project settings.
- Verify the connection string format: `postgresql://user:pass@host.neon.tech/dbname?sslmode=require`

### "Seed failed: relation "site_settings" does not exist"
- The database table was not created. Run the seed script locally to initialize:
  ```bash
  node scripts/seed-settings.mjs
  ```

### "PASS: All 4 settings keys present in DB"
- All configuration is properly seeded. Safe to deploy.

### Admin login fails
- Verify `ADMIN_USERNAME`, `ADMIN_PASSWORD`, and `ADMIN_JWT_SECRET` are correctly set in Vercel.
- Check that the Neon database has the `admin_users` table with seeded credentials.

### AI waiter chat returns empty/error
- Verify `GROQ_API_KEY` or `OPENROUTER_API_KEY` is set.
- Check that `NEXT_PUBLIC_SITE_URL` matches your deployment domain.

## Additional Resources

- **Neon Docs**: https://neon.tech/docs
- **Vercel Docs**: https://vercel.com/docs
- **Next.js Deployment**: https://nextjs.org/docs/deployment
- **Project README**: See project root for architecture details
