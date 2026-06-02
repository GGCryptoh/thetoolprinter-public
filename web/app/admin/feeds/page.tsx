import { createServiceClient } from '@/lib/supabase/server';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { CollapsibleSection } from '@/components/admin/collapsible-section';
import { PaginationControls, parsePage } from '@/components/admin/pagination-controls';
import { createFeed, toggleFeed, deleteFeed } from '../actions';

const PAGE_SIZE = 40;

export default async function FeedsPage({
  searchParams,
}: {
  searchParams?: Promise<{ page?: string | string[]; error?: string | string[] }>;
}) {
  const params = await searchParams;
  const page = parsePage(params?.page);
  const error = Array.isArray(params?.error) ? params?.error[0] : params?.error;
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;
  const supabase = createServiceClient();
  // YouTube / X / LinkedIn ingest all run through Apify. Without a token those
  // fetchers no-op, so only offer the free source types (RSS, GitHub) and tell
  // the operator how to unlock the rest.
  const apifyEnabled = Boolean(process.env.APIFY_API_TOKEN);

  const { data: feeds, count } = await supabase
    .from('aitea_feeds')
    .select('id, type, name, url, active, last_fetched_at, created_at', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, to);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Feeds</h1>
        <CollapsibleSection title="Add Feed" buttonLabel="+ Add Feed">
          <form action={createFeed} className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="type">Type</Label>
              <select
                id="type"
                name="type"
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                required
              >
                <option value="rss">RSS</option>
                <option value="github">GitHub</option>
                {apifyEnabled && <option value="youtube">YouTube</option>}
                {apifyEnabled && <option value="linkedin">LinkedIn</option>}
                {apifyEnabled && <option value="twitter">Twitter</option>}
              </select>
              {!apifyEnabled && (
                <p className="text-xs text-muted-foreground">
                  Set <code>APIFY_API_TOKEN</code> to enable YouTube, X, and LinkedIn sources.
                  RSS covers most blogs and even Reddit (e.g. <code>reddit.com/r/…/.rss</code>).
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input id="name" name="name" placeholder="Feed name" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="url">URL</Label>
              <Input id="url" name="url" placeholder="RSS URL, YouTube channel, LinkedIn profile, or X profile" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="config">Config (JSON)</Label>
              <Textarea
                id="config"
                name="config"
                placeholder='LinkedIn: {"maxPosts": 10, "cadenceHours": 12} · YouTube: {"maxResults": 10} · X: {"handle": "karpathy"}'
                rows={2}
              />
            </div>
            <div className="sm:col-span-2">
              <Button type="submit">Add Feed</Button>
            </div>
          </form>
        </CollapsibleSection>
      </div>

      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          Feed was not added: {error}
        </div>
      )}

      <PaginationControls basePath="/admin/feeds" page={page} pageSize={PAGE_SIZE} total={count ?? 0} />

      <div className="grid gap-2">
        {feeds?.map((feed) => (
          <Card key={feed.id} className="py-2">
            <CardContent className="flex items-center gap-4">
              <Badge variant="secondary" className="shrink-0">{feed.type}</Badge>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm">{feed.name}</span>
                  {!feed.active && <Badge variant="destructive" className="text-[10px] px-1.5 py-0">Inactive</Badge>}
                </div>
                <a
                  href={feed.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[11px] text-muted-foreground hover:text-foreground hover:underline truncate block"
                >
                  {feed.url}
                </a>
                {feed.last_fetched_at && (
                  <span className="text-[10px] text-muted-foreground">
                    Last fetched: {new Date(feed.last_fetched_at).toLocaleString()}
                  </span>
                )}
              </div>
              <div className="flex gap-1.5 shrink-0">
                <form action={toggleFeed.bind(null, feed.id, !feed.active)}>
                  <Button size="sm" variant="outline" type="submit" className="h-7 px-3 text-xs">
                    {feed.active ? 'Disable' : 'Enable'}
                  </Button>
                </form>
                <form action={deleteFeed.bind(null, feed.id)}>
                  <Button size="sm" variant="destructive" type="submit" className="h-7 px-3 text-xs">Delete</Button>
                </form>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <PaginationControls basePath="/admin/feeds" page={page} pageSize={PAGE_SIZE} total={count ?? 0} />
    </div>
  );
}
