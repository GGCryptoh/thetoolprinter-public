# Architecture

## Overview

The Tool Printer (AItea) is a scored, curated AI intelligence platform. It ingests news from 4 sources, scores them with AI, and presents them in a newspaper-style dashboard.

**Stack:** Next.js 16 (App Router) + Supabase + Vercel Workflow + Vercel AI Gateway + shadcn/ui

**Repo:** `GGCryptoh/aitea` (private)
**Domain:** thetoolprinter.com
**Production:** aitea-ten.vercel.app

---

## Project Structure

```
aitea/
├── web/                              # Next.js app (pnpm workspace root)
│   ├── app/
│   │   ├── layout.tsx                # Root layout — dark theme, Geist fonts, metadata
│   │   ├── page.tsx                  # Public landing page — newspaper layout
│   │   ├── admin/
│   │   │   ├── page.tsx              # Login gate (client component, password form)
│   │   │   ├── layout.tsx            # Admin shell — sidebar nav + Suspense wrapper
│   │   │   ├── actions.ts            # All Server Actions (approve, reject, CRUD)
│   │   │   ├── dashboard/page.tsx    # Stats + recent pipeline runs
│   │   │   ├── queue/page.tsx        # Pending items — approve/reject/batch
│   │   │   ├── rejected/page.tsx     # Rejected items — promote
│   │   │   ├── feeds/page.tsx        # Feed CRUD (add/toggle/delete)
│   │   │   ├── people/page.tsx       # People CRUD
│   │   │   ├── knowledge/page.tsx    # Knowledge block JSON editor
│   │   │   └── prompts/page.tsx      # Scoring prompt editor + thresholds
│   │   └── api/
│   │       ├── admin/login/route.ts  # POST: password auth, sets JWT cookie
│   │       └── workflows/ingest/route.ts  # GET/POST: triggers pipeline
│   ├── lib/
│   │   ├── supabase/
│   │   │   ├── server.ts             # createServiceClient() — service role
│   │   │   └── types.ts              # DB types: NewsItem, Feed, Prompt, etc.
│   │   ├── workflow/
│   │   │   ├── ingest.ts             # Main workflow — orchestrates all steps
│   │   │   └── steps/
│   │   │       ├── fetch-rss.ts      # RSS parser ingestion
│   │   │       ├── fetch-youtube.ts  # YouTube via Apify
│   │   │       ├── fetch-twitter.ts  # Twitter/X via Apify
│   │   │       ├── fetch-github.ts   # GitHub trending scraper
│   │   │       ├── score-items.ts    # AI scoring via AI Gateway
│   │   │       └── route-items.ts    # Threshold routing
│   │   ├── scoring/
│   │   │   └── threshold.ts          # Score → section/status mapping
│   │   ├── auth/
│   │   │   └── admin.ts              # JWT sign/verify, password check, cookies
│   │   └── utils.ts                  # cn() utility for shadcn
│   ├── components/
│   │   ├── landing/                  # Public page sections (see below)
│   │   └── ui/                       # shadcn/ui primitives (17 components)
│   ├── proxy.ts                      # Auth gate + security headers
│   ├── next.config.ts                # Workflow plugin, cacheComponents, headers, CSP
│   ├── vercel.json                   # Cron: every 4h
│   ├── tests/
│   │   ├── vitest.config.ts
│   │   └── lib/scoring/threshold.test.ts
│   └── public/
│       └── ai_tea_logo.png           # Mr AI Tea robot logo
├── docs/                             # Documentation
└── pnpm-workspace.yaml
```

---

## Data Flow

```
Vercel Cron (every 4h)
  → POST /api/workflows/ingest
    → Vercel Workflow starts
      → Parallel steps:
        → fetchRSS()        — rss-parser, 3 feeds
        → fetchYouTube()    — Apify actor
        → fetchTwitter()    — Apify actor
        → fetchGitHub()     — trending API scraper
      → Sequential:
        → scoreNewItems()   — AI Gateway (generateText + Output.object)
        → routeItems()      — threshold routing (8+ auto-approve, 5-7 pending, <5 reject)
        → logRun()          — record stats to aitea_workflow_runs
```

---

## Landing Page Sections

| Section | Component | Data Source | Cache |
|---------|-----------|------------|-------|
| The Brew | `brew-section.tsx` | Score 9+ approved items | 5 min, tag: `news` |
| Vibe Engineering | `vibe-section.tsx` | Tag overlap: agents, prompts, tools, etc. | 5 min, tag: `news` |
| Lab Notes | `lab-notes-section.tsx` | Tag overlap: research, models, benchmark, etc. | 5 min, tag: `news` |
| The Workshop | `workshop-section.tsx` | GitHub source + tool-tagged items | 5 min, tag: `news` |
| Hot Takes | `hot-takes-section.tsx` | Twitter source | 5 min, tag: `news` |
| Watch List | `watchlist-section.tsx` | YouTube source | 5 min, tag: `news` |
| People | `people-section.tsx` | `aitea_people` table | 1 hour, tag: `people` |
| The Stacks | `stacks-section.tsx` | `aitea_knowledge_blocks` table | 1 hour, tag: `knowledge` |

**Section nav** is dynamic — only shows sections that have data (count > 0).

**New item indicators** — localStorage tracks `lastVisitTimestamp`. Items newer than last visit get a thin left border accent. Resets 5s after page load.

---

## Authentication

- **Login:** POST `/api/admin/login` — timing-safe password comparison against `ADMIN_PASS` env var
- **Session:** JWT cookie (`aitea-admin`) signed with `ADMIN_JWT_SECRET` via jose, HTTP-only, 7-day expiry
- **Protection:** `proxy.ts` verifies JWT on all `/admin/*` subpages, redirects to login if invalid
- **Rate limiting:** 5 attempts per 15 minutes per IP on login endpoint

---

## Caching Strategy

- **Landing page:** Static shell + cached sections via `'use cache'` + `cacheLife('minutes')` + `cacheTag()`
- **Cache invalidation:** Admin actions call `updateTag()` for immediate cache busting
- **Admin pages:** Partial Prerender (PPR) — static sidebar, dynamic content streamed via `connection()`
- **Zero DB reads on cache hit** for the landing page

---

## Security

- **Headers:** CSP, HSTS, X-Frame-Options DENY, X-Content-Type-Options nosniff, Referrer-Policy, Permissions-Policy
- **Admin:** X-Robots-Tag noindex on `/admin/*`
- **Auth:** Timing-safe password comparison, JWT verification in proxy, rate-limited login
- **RLS:** All `aitea_*` tables have RLS. Public read policies for approved content only. All writes via service role key server-side.
- **Image domains:** Restricted to ytimg.com, ggpht.com, avatars.githubusercontent.com
