# Intelligence Pipeline

End-to-end flow: **fetch → score → route (publishing gate) → images → front page**.

## Triggers

| Trigger | Path | Notes |
|---|---|---|
| Vercel cron (hourly clock tick) | `GET /api/workflows/ingest` (`0 * * * *` in `web/vercel.json`) | Tick ≠ run. `shouldStartScheduledIngest()` (`lib/workflow/schedule.ts`) checks the controller's cadence (every-N-hours interval, or business-hours mode with weekday/weekend windows) and skips if a run isn't due. `?force=1` bypasses the gate. |
| Manual run | `POST /api/workflows/ingest` from `/admin/operations` | Always runs. Phases (fetch/score/route/images) can be toggled per run; a queue-item limit can override the controller's `scoreLimitPerRun`. |
| Stop button | `aitea_knowledge_blocks.ingest_control.stopRequested` | Checked between phases; aborts the remainder of the run. |

Both paths are protected by `CRON_SECRET`. The whole run aborts up front if **AI updates** is off in `/admin/controller`.

All controller settings (cadence, score limits, gate mode, thresholds) live in `aitea_knowledge_blocks` category `front_page_controller` and are edited live in `/admin/controller` — the defaults in `lib/front-page/controller.ts` only apply when no row exists.

## Phase 1 — Fetch (parallel)

All five adapters run via `Promise.all`; one failing source logs an error and returns 0, it never kills the run. New rows land in `aitea_news_items` with `status='pending'`, `score=NULL`, deduplicated by URL.

| Source | File | Mechanism |
|---|---|---|
| RSS | `steps/fetch-rss.ts` | `rss-parser`, active `aitea_feeds` rows of `type='rss'` |
| YouTube | `steps/fetch-youtube.ts` | Apify scraper (needs `APIFY_API_TOKEN`) |
| Twitter/X | `steps/fetch-twitter.ts` | Apify scraper (needs `APIFY_API_TOKEN`) |
| LinkedIn | `steps/fetch-linkedin.ts` | Apify scraper (needs `APIFY_API_TOKEN`) |
| GitHub Trending | `steps/fetch-github.ts` | Unofficial trending API, no key |

## Phase 2 — Score (`steps/score-items.ts`)

- Pulls up to `scoreLimitPerRun` (controller; default 50) unscored pending items, **oldest first**.
- Loads the active Quality Manager prompt from `aitea_prompts` (type = controller's `qualityPromptType`).
- Claude scores **11 weighted dimensions** (relevance 18, recency 14, novelty 12, evidence 12, governanceFit 12, operatorUsefulness 10, sourceQuality 8, clarity 6, distinctiveness 5, riskAwareness 3 — editable in `/admin/controller`). Missing dimensions become `null` and are skipped during weight re-normalization (`lib/front-page/score.ts`), so the 0–10 range stays usable.
- Writes `score`, `score_breakdown`, `summary`, `tags`, `scored_at`. Cost is estimated and logged per batch.

## Phase 3 — Route: the publishing gate (`steps/route-items.ts`)

Pulls **all** scored items with `status='pending'` (including ones routed in earlier runs — see "overflow drain" below), oldest `scored_at` first, then applies the controller gate:

| Condition | Result |
|---|---|
| score ≤ `autoRejectThreshold` | `rejected` (every gate mode, keeps queue clean) |
| score ≥ `autoApproveThreshold` and mode ≠ `human` | `approved` — in `hybrid`, only the first `maxAutoApprovedPerRun` per run; `automatic` has no cap |
| everything between | stays `pending` → Human Review Desk (`/admin/review`) |

Each item also gets a display `section` from `lib/scoring/threshold.ts` (`trending` ≥ 8, `signals` ≥ 5). Approved/rejected items get `reviewed_at = now()`.

**Overflow drain:** in hybrid mode, items above the auto-approve threshold that miss the per-run cap stay `pending` and are *re-evaluated on every subsequent run* (cap still honored), so a backlog of high scorers drains ~`maxAutoApprovedPerRun` per run instead of stranding. Review-band items are re-scanned but skipped without a DB write. (Before 2026-06, a `section IS NULL` filter excluded once-routed items forever — that bug stranded above-threshold items in the review desk permanently.)

Knobs that matter:
- `scoreLimitPerRun` controls how many get **scored** per run — it is *not* an approval limit.
- `maxAutoApprovedPerRun` + `autoApproveThreshold` control publish volume.
- Lowering thresholds affects future routing; already-`pending` above-threshold items now drain automatically.

## Phase 4 — Images (`steps/fetch-og-images.ts`)

Fetches OG images for items missing one.

## Front page consumption

`getFrontPageItems()` (`lib/front-page/controller.ts`) selects approved scored items ordered **`created_at DESC`** (newest first; score is the tiebreak) — it's a news feed, latest wins. `partitionFrontPageItems()` puts the newest approvals from the last 72 h (by `reviewed_at`) into the top-3 "Today's front page" slots, backfilling from older approvals if fewer than 3 are fresh; everything else flows into the infinite older stream. The `/admin/controller` "Top live candidates" preview uses the same query.

## Other crons

| Path | Schedule | Purpose |
|---|---|---|
| `/api/workflows/people-stats` | monthly | LinkedIn people stats scrape |
| `/api/cron/archive-rejected` | daily 04:17 | prune rejected items per `rejectedRetentionDays` |
| `/api/cron/rollup-metrics` | daily 04:30 | daily metrics rollup + log retention |

## Monitoring

- Runs → `aitea_workflow_runs`; per-step events → `logIngestEvent` (visible in `/admin/ingestion`).
- The route step logs `approved / rejected / review` counts plus the gate settings used, so cap-drain progress is visible per run.
