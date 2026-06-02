# Environment Variables

## Required

| Variable | Purpose | Where to get |
|----------|---------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase instance | `https://<your-project>.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public read access | Supabase dashboard |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-side writes (bypasses RLS) | Supabase dashboard |
| `ADMIN_PASS` | Admin login password | Set per environment (Vercel env or local `.env.local`). Never commit the value. |
| `ADMIN_JWT_SECRET` | JWT signing key | `openssl rand -hex 32` |

## AI scoring (Quality Manager)

The scoring step needs an LLM key. Provide it **either** as an env var **or**
via `/admin/ai-providers` (which stores the key encrypted in Supabase Vault).

| Variable | Purpose | Where to get |
|----------|---------|-------------|
| `ANTHROPIC_API_KEY` | Default scoring provider key | Anthropic console (or set a provider in `/admin/ai-providers`) |
| `AITEA_SCORING_MODEL` | Optional override of the scoring model id | — |

## Optional (for source adapters)

RSS and GitHub ingest work with no extra config. The scraped sources
(YouTube, Twitter/X, LinkedIn) need an Apify token plus the actor IDs.

| Variable | Purpose | Where to get |
|----------|---------|-------------|
| `APIFY_API_TOKEN` | YouTube + Twitter + LinkedIn scraping | Apify dashboard |
| `APIFY_YOUTUBE_ACTOR` | Apify actor ID for YouTube | Apify store |
| `APIFY_TWITTER_ACTOR` | Apify actor ID for Twitter/X | Apify store |
| `APIFY_LINKEDIN_ACTOR` | Apify actor ID for LinkedIn | Apify store |
| `CRON_SECRET` | Verify cron requests from Vercel | Vercel dashboard |

## Email registration (lead magnet)

`/api/register` proxies the email capture form on `/what-is-this` to an n8n flow.

| Variable | Purpose | Where to get |
|----------|---------|-------------|
| `N8N_WEBHOOK_URL` | Target webhook URL for the registration flow | n8n production node |
| `N8N_AUTH` | Sent verbatim as the `Authorization` header (no `Bearer` prefix) | n8n webhook auth config |

## Not needed (removed)

| Variable | Replaced by |
|----------|------------|
| `YOUTUBE_API_KEY` | Apify (uses `APIFY_API_TOKEN`) |
| `VERCEL_OIDC_TOKEN` | Auto-provisioned on Vercel deploys |

## Vercel Environment

All variables are set on both `production` and `preview` environments via `vercel env add`.

To sync locally:
```bash
vercel env pull .env.local
```

## Local Development

```bash
cd web
pnpm dev          # starts on localhost:3000
```

Admin login: go to `/admin`, password is in `ADMIN_PASS`.
