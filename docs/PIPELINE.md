# Intelligence Pipeline

## Overview

The pipeline runs every 4 hours via Vercel Cron → Vercel Workflow. It fetches from 4 sources in parallel, scores items with AI, and routes them by score threshold.

## Trigger

- **Cron:** `0 */4 * * *` (every 4h) configured in `web/vercel.json`
- **Manual:** GET/POST `/api/workflows/ingest` (protected by `CRON_SECRET` in production)
- **Route:** `web/app/api/workflows/ingest/route.ts`

## Workflow: `lib/workflow/ingest.ts`

```
"use workflow"
  → logRun(running)
  → Promise.all([fetchRSS, fetchYouTube, fetchTwitter, fetchGitHub])
  → scoreNewItems()
  → routeItems()
  → logRun(completed/failed)
```

Each step uses `"use step"` directive for independent retry.

## Source Adapters

### RSS (`lib/workflow/steps/fetch-rss.ts`)
- Uses `rss-parser` package
- Reads active feeds from `aitea_feeds` where `type = 'rss'`
- Pulls up to 20 items per feed
- Deduplicates by URL (upsert with `ignoreDuplicates`)
- Extracts: title, link, contentSnippet, pubDate, categories, enclosure

### YouTube (`lib/workflow/steps/fetch-youtube.ts`)
- Uses Apify actor `bernardo~youtube-scraper`
- Reads channel URLs from `aitea_feeds` where `type = 'youtube'`
- Pulls 10 most recent videos per channel
- Extracts: title, url, thumbnailUrl, description, date, viewCount, channelName
- Requires: `APIFY_API_TOKEN` env var

### Twitter/X (`lib/workflow/steps/fetch-twitter.ts`)
- Uses Apify actor `apidojo~tweet-scraper`
- Reads handles from `aitea_feeds` config `{handle: "..."}` where `type = 'twitter'`
- Pulls 10 tweets per handle (excludes replies)
- Extracts: full_text, url, likes, retweets, created_at
- Requires: `APIFY_API_TOKEN` env var

### GitHub Trending (`lib/workflow/steps/fetch-github.ts`)
- Scrapes unofficial GitHub trending API
- Falls back to alternative API if primary is down
- Pulls top 25 daily trending repos
- Extracts: author/name, description, stars, forks, language, stars_today
- No API key needed

## AI Scoring (`lib/workflow/steps/score-items.ts`)

- Reads unscored pending items (up to 50)
- Loads active scoring prompt from `aitea_prompts`
- Batches 10 items per AI call
- Uses AI Gateway: `generateText` + `Output.object` with Zod schema
- Model: `anthropic/claude-sonnet-4.5`
- Tags requests: `feature:news-scoring`, `source:pipeline`
- Output per item: `{novelty, impact, relevance, overall, tags[], summary}`

## Threshold Routing (`lib/workflow/steps/route-items.ts`)

Uses `lib/scoring/threshold.ts`:

| Score | Section | Status | Meaning |
|-------|---------|--------|---------|
| 8-10 | trending | **approved** | Auto-published |
| 5-7 | signals | pending | Needs admin review |
| 0-4 | null | rejected | Auto-rejected |

## Monitoring

- Pipeline runs are logged to `aitea_workflow_runs`
- Admin dashboard shows recent runs with items_fetched/items_scored
- Errors per step are stored in the `errors` jsonb column

## Current Feed Configuration

| Type | Name | Config |
|------|------|--------|
| rss | TechCrunch AI | — |
| rss | The Verge AI | — |
| rss | MIT Tech Review AI | — |
| youtube | AI Explained | channelId: UCMnFZMjzUWAfGRzpOL0wGjA |
| youtube | Matt Wolfe | channelId: UCR13l93VgaSITBXMNH-GP1Q |
| youtube | Greg Isenberg | channelId: UCwbQ9iMRf5oMFQc3vmIzifQ |
| twitter | Andrej Karpathy | handle: karpathy |
| twitter | Jim Fan | handle: DrJimFan |
| github | GitHub Trending | — |
