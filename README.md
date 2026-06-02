<div align="center">

# 🖨️ The Tool Printer

### A governed AI front page for people who have to decide.

*An automated intelligence loop with editorial governance built back in — AI reads the field, scores every item against a weighted scorecard, and only what survives review reaches the front page.*

<br/>

![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js&logoColor=white)
![React](https://img.shields.io/badge/React-19-149ECA?logo=react&logoColor=white)
![Supabase](https://img.shields.io/badge/Supabase-Postgres%20%2B%20RLS-3ECF8E?logo=supabase&logoColor=white)
![AI SDK](https://img.shields.io/badge/AI%20SDK-scoring-0EA5E9)
![Tailwind](https://img.shields.io/badge/Tailwind-v4-38BDF8?logo=tailwindcss&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178C6?logo=typescript&logoColor=white)
![Status](https://img.shields.io/badge/status-v1-success)

[**Live → thetoolprinter.com**](https://thetoolprinter.com) · [Setup guide](SETUP.md) · [Architecture](docs/ARCHITECTURE.md) · [Pipeline](docs/PIPELINE.md)

</div>

---

## 💡 Why it exists

Most AI news is slop. The reader's bottleneck isn't access to information — it's having something they trust filter what's worth their time. The Tool Printer reads the field for you, scores it on **recency, evidence, governance fit, and operator usefulness**, and only publishes what clears the gate.

The thesis: as generation gets cheaper, durable value moves to **whoever already burned the tokens** — the party that did the orchestration, scoring, and editorial selection so others can pull the synthesised output instead of redoing the work.

---

## ✨ Features

| | Feature | What it does |
|---|---|---|
| 📡 | **Multi-source ingest** | RSS · GitHub · YouTube · X/Twitter · LinkedIn (the last three via Apify; RSS + GitHub are free) |
| 🧠 | **AI scoring** | A "Quality Manager" agent scores every item on 11 weighted dimensions into a 0–10 editorial score |
| 🚦 | **Publishing gate** | `human` / `hybrid` / `automatic` modes with auto-approve & auto-reject thresholds and a per-run publish cap |
| 🗞️ | **Governed front page** | Top stories, archive stream, favorites, decision stream, and a public transparency report |
| 🕹️ | **Front-page controller** | Tune cadence, article count, scoring limit, gate mode, and per-section visibility — no redeploy |
| ⏰ | **Business-hours scheduling** | Timezone-aware: poll often during weekday hours, back off nights/weekends; per-feed cadence too |
| 🔐 | **Admin console** | Password → JWT cookie, review queue, feeds/people/knowledge editors, AI providers (keys in Supabase Vault) |
| 📊 | **Durable metrics** | Daily roll-up to `aitea_daily_metrics` so raw logs can be pruned without losing cost/volume history |
| 🩺 | **First-run + health** | `/setup` wizard verifies your install; `/admin/health` is a live green/red checklist; `/admin/guide` walks every page |

---

## 🏗️ How the loop works

```
  RSS · X · YouTube · GitHub · LinkedIn
            │
            ▼   ingest workflow  (timezone-aware schedule, controller-gated)
     raw items → aitea_news_items (status = pending)
            │
            ▼   scoring step  (Quality Manager agent, weighted scorecard)
     items get a 0–10 weighted score + full breakdown
            │
            ▼   publishing gate  (human / hybrid / automatic)
     approved items become the front page
            │
            ▼   reader behaviour  (views, hearts, archive scroll)
     feeds back into controller tuning
```

More detail in [`docs/PIPELINE.md`](docs/PIPELINE.md) and [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

---

## 🚀 Quick start

> Full walkthrough in **[SETUP.md](SETUP.md)** — clone → database → env → first-run wizard → verified.

```bash
git clone <your-repo-url> thetoolprinter
cd thetoolprinter/web
pnpm install
cp .env.example .env.local          # fill in Supabase + admin vars
# In the Supabase SQL editor, run:
#   web/supabase/schema.sql   (tables, RLS, functions — idempotent)
#   web/supabase/seed.sql     (starter feeds, people, knowledge, prompt)
pnpm dev                            # http://localhost:3000
```

### ✅ Then validate

1. **`/setup`** — checks DB connectivity, verifies the schema, sets your admin password, then self-disables (404).
2. **`/admin/health`** — green/red checklist: env vars, every table, the crons, workflow runs, AI provider.
3. **`/admin/guide`** — a page-by-page tour for first-time operators.

---

## 🔑 Environment

Full list in [`docs/ENVIRONMENT.md`](docs/ENVIRONMENT.md).

| Variable | Required for |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Page renders |
| `SUPABASE_SERVICE_ROLE_KEY` | All reads + ingest/scoring writes |
| `ADMIN_JWT_SECRET` | Admin session cookie (`openssl rand -hex 32`) |
| `ADMIN_PASS` | Bootstrap `/admin` login (until `/setup` sets a password) |
| `ANTHROPIC_API_KEY` | AI scoring *(or configure a provider in `/admin/ai-providers`)* |
| `APIFY_API_TOKEN` | YouTube / X / LinkedIn ingest *(optional — RSS + GitHub are free)* |
| `CRON_SECRET` · `N8N_*` | Optional — cron auth · lead-capture webhook |

---

## 🗄️ Reproducible database

The schema is **introspected from a live instance**, not hand-written, and is fully reproducible:

- [`web/supabase/schema.sql`](web/supabase/schema.sql) — all `aitea_*` tables, RLS policies, indexes, and Vault key-storage functions (idempotent).
- [`web/supabase/seed.sql`](web/supabase/seed.sql) — starter feeds, people, knowledge blocks, controller config, and the scoring prompt.

Crons are defined in [`web/vercel.json`](web/vercel.json), so a clone + deploy to Vercel re-registers them automatically. Schema details in [`docs/DATABASE.md`](docs/DATABASE.md).

---

## 🛠️ Tech stack

- **Next.js 16** — App Router, RSC, Cache Components
- **Supabase Postgres** — RLS on every table, `aitea_` prefix, Vault for provider keys
- **`ai` SDK** — Quality Manager scoring (Anthropic or any configured provider)
- **Workflow runner** (`@workflow/next`) — the ingest pipeline
- **Tailwind v4** + a small set of bespoke components

---

## 🗺️ Roadmap

- **v0.1 (now):** governed front page, weighted scoring, editorial review, transparency report, business-hours scheduling, daily metrics roll-up.
- **v0.2 (planned):** token-gated `/api/news` for AI harnesses, weekly auto-generated Skills section. See [`docs/ROADMAP.md`](docs/ROADMAP.md).

---

## 📄 License

Code is provided as-is. Editorial content (blog posts, scorecards, summaries) is © Geoff Hopkins, all rights reserved.

<div align="center"><sub>Built by <a href="https://thetoolprinter.com">The Tool Printer</a> · governed AI for people who have to decide.</sub></div>
