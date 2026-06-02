# AItea — Product Requirements Document

**Date:** 2026-04-06
**Version:** 1.1
**Status:** Phases 1-3 Implemented

---

## 1. Overview

AItea is a dynamic, curated AI intelligence platform combining:

- Real-time AI news aggregation
- Curated creators and feeds (YouTube, X)
- Structured knowledge sections (models, context, memory, skills)
- Human-in-the-loop curation layer

**Goal:** A Bloomberg Terminal for AI, optimized for signal over noise.

---

## 2. Core Features

### 2.1 Landing Experience

Modular dashboard (scrollable sections):

- Trending AI News (scored + curated)
- YouTube Feed (selected channels)
- AI Knowledge Blocks: Models, Context engineering, Memory patterns, Agent skills
- People to Follow (X/Twitter)
- Signals (emerging tools, repos, trends)

**UX:** Fast, minimal, high-density. Card-based + terminal-like scanning. Dark premium metric dashboard (Memoria design system).

### 2.2 News Intelligence Engine

**Pipeline:**

1. **Ingestion** — APIs (RSS), YouTube API, Apify (X/Twitter scraping), GitHub trending
2. **Scoring (AI Gateway)** — Prompt-driven scoring: Novelty, Impact, Practical relevance, Signal vs noise. Output: structured scorecard (JSON).
3. **Threshold Routing** — Code-based deterministic routing: 8-10 = trending, 5-7 = signals, 0-4 = rejected
4. **Queue System** — Stored in Supabase. Status: `pending`, `approved`, `rejected`
5. **Human-in-the-loop** — Admin reviews suggestions, rejections, scores. One-click approve/edit.

### 2.3 Admin Panel (/admin)

**Access:** Protected via `ADMIN_PASS` env var (MVP). Later: Supabase Auth + roles.

**Capabilities:**

- Add YouTube channels
- Add Twitter/X accounts
- Add curated links/resources
- Edit knowledge sections
- Review news queue: Accept/Reject, Override score
- Suggested feeds: Pipeline proposes "Add this channel?" / "Add this person?"
- Rejection review: See filtered-out content, promote if missed
- Prompt/threshold editor: Tune scoring without redeployment

### 2.4 Knowledge Engine

Semi-dynamic sections stored as JSON in Supabase:

- Best models (updated periodically)
- Context patterns
- Memory strategies
- Agent skills

Editable via admin panel. No redeployment needed.

### 2.5 YouTube Integration

- Channel-based ingestion via YouTube Data API v3
- Pull latest videos with metadata
- AI relevance scoring via same pipeline
- Clean card UI with "Worth watching" tag for high-scoring items

### 2.6 People to Follow

Curated list of builders, researchers, operators.

Attributes: Name, Handle, Avatar, Why follow, Tags (agents, infra, models)

### 2.7 Analytics

- Vercel Analytics integration: Visitors, Section engagement
- **Opt-in consent gate** (CIPA/CCPA): the `<Analytics />` script is mounted only after the
  visitor accepts the consent bar (`ConsentManager`); declining or ignoring it means no analytics
  request or storage ever fires. Choice persisted in `localStorage` (`ttp-analytics-consent`),
  changeable via the footer "Cookie settings" control. Documented at `/cookie-policy` and `/privacy`.
- Admin view: Top clicked content, Trending topics (Phase 4)

---

## 3. Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js (App Router) |
| Hosting | Vercel |
| Database | Supabase (Postgres, existing instance) |
| AI | Vercel AI Gateway |
| Pipeline | Vercel Workflow + Vercel Cron |
| Auth (admin) | Password gate (JWT cookie) |
| UI | Tailwind CSS + shadcn/ui + Memoria design system |
| RSS | rss-parser |
| X/Twitter | Apify |
| YouTube | YouTube Data API v3 |
| GitHub | Scraping / unofficial API |

---

## 4. Data Model

All tables prefixed `aitea_`. RLS enabled on all tables.

**aitea_news_items** — id, title, source_type, source_name, url (unique), image_url, summary, score, score_breakdown (jsonb), status, section, tags, raw_metadata (jsonb), created_at, scored_at, reviewed_at

**aitea_feeds** — id, type, name, url, config (jsonb), active, last_fetched_at, created_at

**aitea_knowledge_blocks** — id, category (unique), title, content_json (jsonb), sort_order, updated_at

**aitea_people** — id, name, handle, avatar_url, description, tags, sort_order, active, created_at

**aitea_prompts** — id, type, version, content, active, created_at. UNIQUE(type, version)

**aitea_workflow_runs** — id, workflow_run_id, status, items_fetched, items_scored, errors (jsonb), started_at, completed_at

---

## 5. Automation & Scheduling

- Vercel Cron triggers every 4 hours
- Cron hits `/api/workflows/ingest` which starts a Vercel Workflow
- Workflow runs source adapters as parallel steps with independent retry
- Sequential scoring and routing steps after all sources complete

---

## 6. User Flow

**Visitor:** Lands → scans sections → clicks into content

**Admin:** Login → review queue → approve/reject → Add feeds → see suggestions → accept

---

## 7. MVP Scope

**Include:**
- Landing page (trending news + YouTube + people + knowledge + signals)
- Admin panel (password auth)
- News ingestion + AI scoring (all 4 sources)
- Manual curation (approve/reject queue)
- Threshold-based routing
- Feed management

**Exclude (future phases):**
- Personalization / user accounts
- "Daily AI Brief" email
- Agent-driven summaries
- Community voting
- Slack/Discord integration
- Advanced analytics
- Real-time feeds

---

## 8. Success Criteria

- Pipeline ingests from all 4 sources without manual intervention
- AI scoring produces meaningful differentiation (not all items scored the same)
- Admin can review and approve/reject items in < 30 seconds per item
- Public page loads in < 2 seconds with cached content
- Content is fresh within 4 hours of publication at source

---

## 9. Key Differentiator

- Not just aggregation
- Scored + curated + explainable signal system
- Human + AI hybrid editorial layer
- Versioned, tunable prompts — scoring improves over time without code changes

---

## 10. Future Enhancements

- Personalized feeds (user profiles)
- "Daily AI Brief" email (via Resend)
- Agent-driven summaries
- Portfolio tracking of tools/models
- Community voting layer
- Slack/Discord integration
