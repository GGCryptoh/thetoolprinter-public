import { CheckCircle2, CircleAlert, Database, KeyRound, Radio, SquarePlay } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getFrontPageController } from '@/lib/front-page/controller';
import { createServiceClient } from '@/lib/supabase/server';

const DEFAULT_YOUTUBE_ACTOR = 'streamers~youtube-scraper';
const DEFAULT_TWITTER_ACTOR = 'apidojo~tweet-scraper';

function StatusRow({
  label,
  configured,
  detail,
}: {
  label: string;
  configured: boolean;
  detail: string;
}) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-md border bg-card/60 p-4">
      <div className="flex items-start gap-3">
        {configured ? (
          <CheckCircle2 className="mt-0.5 size-5 text-emerald-500" />
        ) : (
          <CircleAlert className="mt-0.5 size-5 text-yellow-500" />
        )}
        <div>
          <p className="text-sm font-medium">{label}</p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">{detail}</p>
        </div>
      </div>
      <Badge variant={configured ? 'default' : 'secondary'}>
        {configured ? 'Ready' : 'Missing'}
      </Badge>
    </div>
  );
}

export default async function IngestionPage() {
  const supabase = createServiceClient();
  const apifyConfigured = Boolean(process.env.APIFY_API_TOKEN);
  const youtubeActor = process.env.APIFY_YOUTUBE_ACTOR || DEFAULT_YOUTUBE_ACTOR;
  const twitterActor = process.env.APIFY_TWITTER_ACTOR || DEFAULT_TWITTER_ACTOR;

  const [settings, { count: youtubeFeeds }, { count: twitterFeeds }, { count: rssFeeds }, { count: seenItems }] =
    await Promise.all([
      getFrontPageController(),
      supabase.from('aitea_feeds').select('id', { count: 'exact', head: true }).eq('type', 'youtube').eq('active', true),
      supabase.from('aitea_feeds').select('id', { count: 'exact', head: true }).eq('type', 'twitter').eq('active', true),
      supabase.from('aitea_feeds').select('id', { count: 'exact', head: true }).eq('type', 'rss').eq('active', true),
      supabase.from('aitea_news_items').select('id', { count: 'exact', head: true }),
    ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Ingestion</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Runtime keys, Apify actors, source counts, and de-dupe posture for the feed process.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm text-muted-foreground">
              <SquarePlay className="size-4" />
              YouTube
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-mono text-3xl font-bold">{youtubeFeeds ?? 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm text-muted-foreground">
              <Radio className="size-4" />
              X/Twitter
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-mono text-3xl font-bold">{twitterFeeds ?? 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm text-muted-foreground">
              <Database className="size-4" />
              RSS
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-mono text-3xl font-bold">{rssFeeds ?? 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Seen URLs</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-mono text-3xl font-bold">{seenItems ?? 0}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Schedule and controls</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 lg:grid-cols-3">
          <div className="rounded-md border p-4">
            <p className="text-sm font-medium">Main ingest</p>
            <p className="mt-2 font-mono text-xs text-muted-foreground">0 * * * *</p>
            <p className="mt-3 text-xs leading-5 text-muted-foreground">
              Vercel calls <span className="font-mono">/api/workflows/ingest</span> hourly.
              The controller runs it every {settings.scheduleEvery} {settings.scheduleUnit}
              {settings.aiUpdatesEnabled ? '.' : ', but AI updates are currently off.'}
            </p>
          </div>
          <div className="rounded-md border p-4">
            <p className="text-sm font-medium">People stats</p>
            <p className="mt-2 font-mono text-xs text-muted-foreground">0 0 1 * *</p>
            <p className="mt-3 text-xs leading-5 text-muted-foreground">
              Runs monthly for audience/source stats and keeps creator context fresh.
            </p>
          </div>
          <div className="rounded-md border p-4">
            <p className="text-sm font-medium">Manual trigger</p>
            <p className="mt-2 text-xs leading-5 text-muted-foreground">
              In production, pass the cron secret as <span className="font-mono">?token=...</span>.
              In local dev with no secret, visit <span className="font-mono">/api/workflows/ingest</span>.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <KeyRound className="size-5" />
            Apify runtime
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <StatusRow
            label="APIFY_API_TOKEN"
            configured={apifyConfigured}
            detail={
              apifyConfigured
                ? 'The server runtime can see the token. The value is never sent to the browser.'
                : 'Set this in Vercel, then pull env vars locally if you want the dev server to scrape.'
            }
          />
          <a
            href={apifyConfigured ? '/admin/ingestion/apify-test' : undefined}
            target="_blank"
            rel="noreferrer"
            aria-disabled={!apifyConfigured}
            className={buttonVariants({
              variant: 'outline',
              className: !apifyConfigured ? 'pointer-events-none opacity-50' : '',
            })}
          >
            Test Apify connection
          </a>
          <div className="rounded-md border bg-muted/30 p-4">
            <p className="text-sm font-medium">Set or rotate in Vercel</p>
            <pre className="mt-3 overflow-x-auto rounded-md bg-background p-3 text-xs text-muted-foreground">
{`vercel env add APIFY_API_TOKEN production preview development --sensitive
vercel env pull .env.local --yes`}
            </pre>
            <p className="mt-3 text-xs leading-5 text-muted-foreground">
              This app intentionally reads Apify from server-only env vars. To let the admin UI write
              Vercel env vars directly later, add a scoped Vercel API token and project id, then call
              the Vercel REST API from a server action.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Apify actors and de-dupe</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-md border p-4">
            <p className="text-sm font-medium">YouTube actor</p>
            <p className="mt-2 font-mono text-xs text-muted-foreground">{youtubeActor}</p>
            <p className="mt-3 text-xs leading-5 text-muted-foreground">
              Default captures latest channel videos and asks for subtitles/transcripts when the actor
              supports it. Each video becomes a scored idea source.
            </p>
          </div>
          <div className="rounded-md border p-4">
            <p className="text-sm font-medium">X/Twitter actor</p>
            <p className="mt-2 font-mono text-xs text-muted-foreground">{twitterActor}</p>
            <p className="mt-3 text-xs leading-5 text-muted-foreground">
              Feed config can override the actor per source with <span className="font-mono">{'{"actor":"owner~actor"}'}</span>.
            </p>
          </div>
          <div className="rounded-md border p-4 lg:col-span-2">
            <p className="text-sm font-medium">Repeat protection</p>
            <p className="mt-2 text-xs leading-5 text-muted-foreground">
              Incoming RSS, YouTube, and X URLs are canonicalized before insert: tracking params are
              stripped, YouTube short/embed links normalize to watch URLs, fragments are removed, and
              Supabase still enforces the unique URL key. Older sightings are skipped instead of
              becoming duplicate queue items.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
