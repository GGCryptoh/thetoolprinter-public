import Parser from 'rss-parser';
import { createServiceClient } from '@/lib/supabase/server';
import type { NewNewsItem, Feed } from '@/lib/supabase/types';
import { dedupeByCanonicalUrl, normalizeContentUrl } from '@/lib/workflow/url';
import { countWords, logIngestEvent } from '@/lib/workflow/events';
import { dueFeeds } from '@/lib/workflow/feed-schedule';
import { decodeHtmlEntities } from '@/lib/text';

const parser = new Parser({
  timeout: 10000,
  headers: { 'User-Agent': 'AItea/1.0' },
});

export async function fetchRSS(workflowRunId?: string): Promise<number> {
  "use step";

  console.log('[fetch-rss] Starting RSS fetch');
  const supabase = createServiceClient();

  const { data: feeds, error: feedError } = await supabase
    .from('aitea_feeds')
    .select('*')
    .eq('type', 'rss')
    .eq('active', true);

  if (feedError || !feeds) {
    throw new Error(`Failed to fetch RSS feeds: ${feedError?.message}`);
  }

  await logIngestEvent({
    workflowRunId,
    step: 'fetch:rss',
    message: `Scanning ${feeds.length} RSS feeds.`,
    sourceType: 'rss',
    metrics: { feeds: feeds.length },
  });

  const feedsToScan = dueFeeds(feeds as Feed[]);
  const skipped = feeds.length - feedsToScan.length;

  let totalInserted = 0;

  for (const feed of feedsToScan) {
    try {
      await logIngestEvent({
        workflowRunId,
        step: 'fetch:rss:feed',
        message: `Reading RSS feed ${feed.name}.`,
        sourceType: 'rss',
        sourceName: feed.name,
        metrics: { url: feed.url },
      });

      const parsed = await parser.parseURL(feed.url);
      const items: NewNewsItem[] = (parsed.items ?? []).slice(0, 20).map((item) => {
        const rawSummary = item.contentSnippet?.slice(0, 300) ?? item.content?.slice(0, 300) ?? null;
        return {
          title: decodeHtmlEntities(item.title ?? 'Untitled'),
          source_type: 'rss' as const,
          source_name: feed.name,
          url: item.link ?? item.guid ?? '',
          image_url: item.enclosure?.url ?? null,
          summary: rawSummary ? decodeHtmlEntities(rawSummary) : null,
          raw_metadata: {
            pub_date: item.pubDate ?? null,
            categories: item.categories ?? [],
            feed_id: feed.id,
          },
        };
      });

      const validItems = dedupeByCanonicalUrl(items
        .filter((i) => i.url !== '')
        .map((item) => ({
          ...item,
          raw_metadata: {
            ...item.raw_metadata,
            source_url: item.url,
            canonical_url: normalizeContentUrl(item.url) ?? item.url,
          },
        })));

      if (validItems.length > 0) {
        const { data, error } = await supabase
          .from('aitea_news_items')
          .upsert(validItems, { onConflict: 'url', ignoreDuplicates: true })
          .select('id');

        if (!error && data) {
          totalInserted += data.length;
          await logIngestEvent({
            workflowRunId,
            step: 'fetch:rss:feed',
            level: 'success',
            message: `${feed.name}: ${data.length} new RSS items from ${validItems.length} valid candidates.`,
            sourceType: 'rss',
            sourceName: feed.name,
            metrics: {
              candidates: parsed.items?.length ?? 0,
              valid: validItems.length,
              inserted: data.length,
              words: validItems.reduce((sum, item) => sum + countWords(item.title, item.summary), 0),
            },
          });
        }
      }

      await supabase
        .from('aitea_feeds')
        .update({ last_fetched_at: new Date().toISOString() })
        .eq('id', feed.id);
    } catch (err) {
      console.error(`[fetch-rss] Feed failed for ${feed.name}:`, err);
      await logIngestEvent({
        workflowRunId,
        step: 'fetch:rss:error',
        level: 'error',
        message: `${feed.name} failed during RSS fetch.`,
        sourceType: 'rss',
        sourceName: feed.name,
        metrics: { error: String(err) },
      });
    }
  }

  console.log(`[fetch-rss] Done — inserted ${totalInserted} items`);
  await logIngestEvent({
    workflowRunId,
    step: 'fetch:rss',
    level: 'success',
    message: `RSS scan complete: ${totalInserted} new items.`,
    sourceType: 'rss',
    metrics: { inserted: totalInserted, skippedByCadence: skipped },
  });
  return totalInserted;
}
