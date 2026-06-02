# Roadmap

## v0.1 — shipped

The governed reader surface.

- Governed front page with weighted scoring (`lib/front-page/score.ts`)
- Editorial review queue, controller, knowledge editor in `/admin`
- Transparency surface at `/report` (event stream, decision stream, financials)
- Reader UX: favorites + heart cards, viewed-state, hide-viewed toggle, archive infinite stream, weighted scorecard panel
- Mobile-first front page reorder (news above thesis, "more news below" jump)
- HTML entity decoding at both ingest and display
- ESC-to-back on every subpage
- Email registration via `/api/register` → n8n (lead magnet for v0.2)
- Blog scaffolding at `/blog` with hand-written posts

## v0.2 — planned

Building on the v0.1 thesis: **the durable value moves to whoever already burned the tokens.** The site already does the orchestration, scoring, and editorial selection. v0.2 makes that output addressable by AI harnesses and adds the second editorial output (skills) the site itself produces.

### Token-gated `/api/news`

Goal: any reader can register for a personal API token and pipe the governed feed straight into Claude Code, Codex, an n8n flow, or any HTTP client. They read the same approved articles your front page sees — without burning their own scoring tokens.

Sketch:

- `aitea_api_tokens (id, email, token, created_at, last_used_at, revoked_at)`
- `/api/register` (already live, currently lead-magnet only) generates a token, inserts a row, forwards `{ email, token }` to n8n so the welcome email carries it.
- New `GET /api/news?since=...&limit=...` validates `Authorization: Bearer <token>` against the table, returns JSON `{ items: NewsItem[] }`.
- Rate limit per token (e.g. 60 req/min). Update `last_used_at` for visibility.
- Token revocation surface in `/admin`.

Estimated effort: ~45 min build once we lock the response schema.

### Weekly auto-generated Skills section

Goal: every week the system scans for "what new skill / capability is worth packaging" and produces a fresh `SKILL.md` that readers can download and drop into Claude Code or another agent harness. The site becomes a small giving-back artefact, not just a reading surface.

Sketch:

- Front-page section (above Partner Questions) showing the latest skill: title, premise, one-line setup, download button.
- Dedicated `/skills` page: filter by topic, lightbox-style detail view with keyboard nav (←/→/Esc), copy-prompt button, raw download.
- Supabase: `aitea_skills (id, slug, title, premise, body_md, tags, created_at, source_refs[])`.
- Weekly workflow (cron Sunday 10am): LLM scans recent approved items + external sources, dedupes against existing catalogue, drafts a new SKILL.md, persists.
- UI ships first with hand-curated seeds so the surface is real before the workflow lands.

### Weekly source discovery + self-tuned feeds

Goal: the system proposes its own new sources every week, the operator only weighs in on the edge cases, and underperforming feeds quietly pause themselves with a written rationale.

Sketch:

- Weekly job (Sunday tick) scans the field for candidate sources — new AI-focused RSS feeds, YouTube channels, LinkedIn accounts, X handles — and produces a structured proposal list.
- Each proposal lands in `/admin/sources/discovery` with: source, why suggested (evidence from existing scoring data + external mentions), expected fit signal, recommended action (approve / hold / reject).
- Manual review default for the first run.
- Auto-approve threshold: a candidate above a confidence bar can be added without human review. Newly auto-added feeds enter a "probation" window; if their items score above the bar over N runs, they graduate; if their items consistently underperform, the feed is auto-paused with a one-line rationale shown in the admin control panel.
- Same loop applies to existing feeds going stale — if a long-standing source's average score drops, it gets paused and flagged for review.
- Discovery and scraping uses Apify ([apify.com](https://apify.com)) for the platforms without clean RSS (YouTube, LinkedIn, X).
- New table: `aitea_source_proposals (id, type, url, evidence_json, confidence, status, decided_at, decided_by, rationale)`. Reuses the existing `aitea_feeds` for approved entries.

Effort estimate: medium — the scoring + proposal LLM step is the bulk, the admin surface and probation logic are straightforward.

### Operational hardening

- Rate limit `/api/register` (the lead magnet endpoint is currently open).
- Touch swipe gestures on the article lightbox.
- Loading skeletons on home + archive (currently relying on Suspense fallback).
- Per-post OG image generation.
- Vitest suite for `computeWeightedScore`, `decodeHtmlEntities`, scorecard weighting.

## v0.3+ — speculative

- Personalised feed based on reader behaviour (favorites + viewed history).
- Sharing primitives: "share with score chip" for LinkedIn / X.
- RSS export of the approved feed (be a citizen — emit RSS since we eat it).
- Newsletter digest path via n8n.
- Author bio + multiple editor support if scope ever expands beyond one editor.
