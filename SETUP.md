# Setup — from clone to running

This walks you from a fresh `git clone` to a working local site, then to a
deployed one. Budget ~15 minutes for local, ~15 more for deploy.

> **TL;DR:** install deps → create a Supabase project → apply `schema.sql` +
> `seed.sql` → fill `.env.local` → `pnpm dev` → open `/setup` → set your admin
> password → you're in.

---

## 0. Prerequisites

- **Node 20+** and **pnpm** (`npm i -g pnpm`)
- A **Supabase** account (free tier is fine)
- An **Anthropic API key** for AI scoring (or skip scoring at first)
- *(optional)* An **Apify** token if you want YouTube / X / LinkedIn ingest
- *(optional, for deploy)* A **Vercel** account

---

## 1. Install

```bash
git clone <your-repo-url> thetoolprinter
cd thetoolprinter/web
pnpm install
```

All app code lives in `web/`. The repo is a pnpm workspace; commands run from `web/`.

---

## 2. Create the database

1. Create a new project at [supabase.com](https://supabase.com). Note your
   **Project URL** and, under **Project Settings → API**, your **anon** and
   **service_role** keys.
2. Open the project's **SQL Editor**.
3. Paste the entire contents of [`web/supabase/schema.sql`](web/supabase/schema.sql)
   and run it. This creates all 11 `aitea_` tables, RLS policies, indexes, and
   the Vault key-storage functions. It is safe to re-run.
4. Paste the contents of [`web/supabase/seed.sql`](web/supabase/seed.sql) and
   run it. This loads starter feeds, people, knowledge blocks, the front-page
   controller config, and the scoring prompt. Also safe to re-run.

> The first-run `/setup` page (step 5) will verify these tables exist and tell
> you exactly what's missing if a step didn't take.

---

## 3. Configure environment

```bash
cp .env.example .env.local
```

Fill in at minimum:

| Variable | Value |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase Project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Service-role key |
| `ADMIN_PASS` | A bootstrap admin password (you can replace it in `/setup`) |
| `ADMIN_JWT_SECRET` | `openssl rand -hex 32` |
| `ANTHROPIC_API_KEY` | Anthropic key (or configure later in `/admin/ai-providers`) |

Everything else is optional — see [`docs/ENVIRONMENT.md`](docs/ENVIRONMENT.md).
Without `APIFY_*`, RSS and GitHub ingest still work; the scraped sources stay idle.

---

## 4. Run it

```bash
pnpm dev          # http://localhost:3000
```

The home page renders from the seeded data. It will look sparse until the
ingest pipeline runs and you approve some items.

---

## 5. First-run setup (`/setup`)

Open **http://localhost:3000/setup**. This one-time wizard:

1. **Checks connectivity** to Supabase.
2. **Verifies the schema** — confirms all `aitea_` tables exist (and points you
   back to step 2 if not).
3. **Sets your admin password** — stored hashed in the database. (`ADMIN_PASS`
   stays as a fallback.)
4. **Confirms cron + workflow** wiring.

Once completed, `/setup` becomes a dead route (it returns 404) so it can't be
re-run by a visitor. You can re-open it only by clearing the setup flag in the
database.

> **⚠️ Set `ADMIN_PASS` before the deploy is publicly reachable.** Completing
> setup requires the bootstrap password — the API refuses to finish setup
> without it (403). This closes the first-run takeover window where an
> anonymous visitor could otherwise set the admin password on a fresh deploy.

---

## 6. Log in and verify

Go to **`/admin`**, log in with the password you just set. First stop:
**`/admin/health`** (System Health) — a green/red checklist confirming env vars,
DB reachability, every table, cron registration, workflow deployment, and AI
provider status. Get everything green and you're production-ready.

New to the admin? Follow the **first-time admin guide** linked from the admin
dashboard — it walks every page in order.

---

## 7. Run the pipeline once

You don't have to wait for the hourly cron. Trigger ingest manually:

```bash
curl -X POST http://localhost:3000/api/workflows/ingest
```

Watch it live at **`/admin/operations`**. New items land in **`/admin/queue`**
for review. Approve a few and they appear on the home page.

---

## 8. Deploy to Vercel

```bash
# from web/
vercel link
vercel env pull .env.local     # or add vars in the Vercel dashboard
vercel --prod
```

- Set every variable from `.env.local` in the Vercel project (Production + Preview).
- The crons in [`web/vercel.json`](web/vercel.json) register automatically:
  - `/api/workflows/ingest` — hourly
  - `/api/workflows/people-stats` — monthly
  - `/api/cron/archive-rejected` — daily
- Set `CRON_SECRET` in Vercel and in your env so cron calls are verified.

Then visit `https://<your-domain>/setup` once on production to set the admin
password there too (the flag is per-database, so a fresh prod DB needs it).

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| `/setup` says tables missing | Re-run `schema.sql` in the Supabase SQL editor |
| Home page empty | No approved items yet — run ingest (step 7) and approve in `/admin/queue` |
| Admin login "password not configured" | Set `ADMIN_PASS` or complete `/setup` |
| Scoring step errors | Set `ANTHROPIC_API_KEY` or configure a provider in `/admin/ai-providers` |
| Scraped sources idle | Set `APIFY_API_TOKEN` and the `APIFY_*_ACTOR` ids |

More detail: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md),
[`docs/PIPELINE.md`](docs/PIPELINE.md), [`docs/ADMIN.md`](docs/ADMIN.md).
