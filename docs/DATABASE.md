# Database Schema

> **Source of truth:** [`web/supabase/schema.sql`](../web/supabase/schema.sql)
> is generated directly from the live database and is what you apply to a fresh
> clone. Starter data lives in [`web/supabase/seed.sql`](../web/supabase/seed.sql).
> This document is the human-readable companion — if the two ever disagree,
> trust the SQL.

**All tables prefixed:** `aitea_`
**RLS:** Enabled on all 11 tables

---

## Tables

### aitea_news_items

Primary content table. All ingested items from all sources.

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | gen_random_uuid() |
| title | text NOT NULL | |
| source_type | text NOT NULL | `rss`, `youtube`, `twitter`, `github`, `linkedin` |
| source_name | text | Feed name, channel, handle |
| url | text NOT NULL UNIQUE | Deduplication key |
| image_url | text | Thumbnail |
| summary | text | AI-generated or source excerpt |
| score | numeric(4,2) | Weighted display score (0.00–10.00) computed from `score_breakdown` using dimension weights in `lib/front-page/score.ts`. Written by both the scoring workflow and the one-time backfill. |
| score_breakdown | jsonb | Full quality manager output: `{relevance, recency, novelty, impact, evidence, governanceFit, operatorUsefulness, sourceQuality, clarity, distinctiveness, riskAwareness, qualityScore, qualityReason}`. `qualityScore` preserves the LLM's original integer overall. |
| status | text DEFAULT 'pending' | `pending`, `approved`, `rejected` |
| section | text | `trending`, `signals`, or null |
| tags | text[] | From AI scoring prompt |
| raw_metadata | jsonb | Source-specific (stars, likes, etc.) |
| created_at | timestamptz | |
| scored_at | timestamptz | |
| reviewed_at | timestamptz | |
| archived_at | timestamptz | Set when an item is soft-archived (see `archive-rejected` cron) |

**Indexes:** status, section, score, created_at DESC, archived_at, and a partial index on status WHERE archived_at IS NULL
**RLS:** Public read where `status = 'approved'`

### aitea_feeds

Configured data sources managed via admin.

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| type | text NOT NULL | `rss`, `youtube`, `twitter`, `github`, `linkedin` |
| name | text NOT NULL | Display name |
| url | text NOT NULL | Feed/channel/handle URL |
| config | jsonb DEFAULT '{}' | `{channelId}`, `{handle}`, `{maxPosts}`, `{cadenceHours}`, etc. |
| active | boolean DEFAULT true | |
| last_fetched_at | timestamptz | |
| created_at | timestamptz | |

**RLS:** Public read where `active = true`

### aitea_knowledge_blocks

Structured knowledge sections editable via admin.

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| category | text NOT NULL UNIQUE | `models`, `context`, `memory`, `skills` |
| title | text NOT NULL | |
| content_json | jsonb NOT NULL | Array of `{name, description, url?, tags?}` |
| sort_order | integer DEFAULT 0 | |
| updated_at | timestamptz | |

**RLS:** Public read (all rows)

> **Dual purpose:** two rows here are operational config, not reader content —
> `front_page_controller` (cadence, gate mode, auto-approve/reject thresholds)
> and `ingest_control` (`stopRequested` kill-switch). The Front Page Controller
> admin page reads/writes these.

### aitea_people

Curated people to follow.

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| name | text NOT NULL | |
| handle | text NOT NULL | X/Twitter handle |
| avatar_url | text | |
| description | text | Why follow |
| tags | text[] | `agents`, `infra`, etc. |
| sort_order | integer DEFAULT 0 | |
| active | boolean DEFAULT true | |
| created_at | timestamptz | |
| url | text | Profile/source URL |
| sources | text[] | Which feed types this person is followed on (`twitter`, `youtube`, …) |

**RLS:** Public read where `active = true`

### aitea_prompts

Versioned scoring prompt templates.

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| type | text NOT NULL | `scoring` |
| version | integer DEFAULT 1 | |
| content | text NOT NULL | Prompt template with `{{items}}` placeholder |
| active | boolean DEFAULT true | |
| created_at | timestamptz | |

**Unique:** (type, version)
**RLS:** No public read (server-side only)

### aitea_workflow_runs

Pipeline execution log.

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| workflow_run_id | text | Vercel Workflow run ID |
| status | text DEFAULT 'running' | `running`, `completed`, `failed` |
| items_fetched | integer DEFAULT 0 | |
| items_scored | integer DEFAULT 0 | |
| errors | jsonb DEFAULT '[]' | Per-step error log |
| started_at | timestamptz | |
| completed_at | timestamptz | |

**RLS:** No public read (admin-only)

### aitea_ingest_events

Append-only telemetry for the live ingest surveillance page.

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| workflow_run_id | text | Links to `aitea_workflow_runs.workflow_run_id` |
| step | text | `fetch:rss`, `score:item`, `route`, `complete`, etc. |
| level | text | `info`, `success`, `warning`, `error` |
| message | text | Human-readable event text |
| source_type | text | Optional source category |
| source_name | text | Optional feed/channel/person name |
| item_id | uuid | Optional link to `aitea_news_items` |
| metrics | jsonb | Counts, word totals, scores, batch numbers, error detail |
| created_at | timestamptz | |

**RLS:** Service-role only. Admin pages read this server-side.

### aitea_ai_provider_configs

AI provider selection for scoring. The actual API key is stored in Supabase
Vault; only the secret's id is kept here.

| Column | Type | Notes |
|--------|------|-------|
| provider | text PK | `openai`, `anthropic`, `deepseek` |
| vault_secret_id | uuid | Points at the key in `vault.secrets` |
| selected_model | text | Chosen model id |
| active_for_scoring | boolean DEFAULT false | Which provider the scoring step uses |
| model_catalog | jsonb DEFAULT '[]' | Cached list of available models |
| last_checked_at | timestamptz | |
| updated_at | timestamptz | |

**RLS:** Service-role only.

**Vault helper functions** (in `schema.sql`):
- `aitea_save_ai_provider_secret(provider, secret, existing_id?)` → upserts the key into Vault, returns the secret id.
- `aitea_read_ai_provider_secret(secret_id)` → returns the decrypted key.

### aitea_people_stats

Scraped follower/engagement history per person (monthly `people-stats` cron).

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| person_id | uuid | FK → `aitea_people(id)` ON DELETE CASCADE |
| followers / following / posts_count | integer | |
| avg_engagement | numeric | |
| scraped_at | timestamptz DEFAULT now() | |
| raw_data | jsonb | Full scrape payload |

**Index:** (person_id, scraped_at DESC). **RLS:** Service-role only.

### aitea_activity_log

Append-only log of admin/system actions.

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| action | text NOT NULL | |
| detail | text | |
| metadata | jsonb DEFAULT '{}' | |
| created_at | timestamptz DEFAULT now() | |

**RLS:** Service-role only.

### aitea_daily_metrics

Rolled-up daily counters powering `/admin/financials`.

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| date | date NOT NULL UNIQUE | |
| items_fetched / items_scored / items_approved / items_rejected | integer DEFAULT 0 | |
| ai_tokens_used | integer DEFAULT 0 | |
| ai_cost_cents | integer DEFAULT 0 | |
| workflow_runs | integer DEFAULT 0 | |
| feeds_active | integer DEFAULT 0 | |
| created_at | timestamptz DEFAULT now() | |

**RLS:** Service-role only.

---

## Seeded Data

- **Feeds:** TechCrunch AI, The Verge AI, MIT Tech Review, AI Explained (YT), Matt Wolfe (YT), Greg Isenberg (YT), @karpathy (X), @DrJimFan (X), GitHub Trending
- **People:** Karpathy, Jim Fan, Simon Willison, Swyx, Harrison Chase, Greg Isenberg
- **Knowledge:** Models (Opus 4.6, Sonnet 4.6, GPT-5.4, Gemini 3.1, Llama 4), Context Engineering, Memory Patterns, Agent Skills
- **Prompts:** Quality Manager scoring prompt (active)
