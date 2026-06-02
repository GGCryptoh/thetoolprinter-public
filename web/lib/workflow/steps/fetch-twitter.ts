import { createServiceClient } from '@/lib/supabase/server';
import type { NewNewsItem, Feed } from '@/lib/supabase/types';
import { dedupeByCanonicalUrl, normalizeActorId, normalizeContentUrl } from '@/lib/workflow/url';
import { countWords, logIngestEvent } from '@/lib/workflow/events';
import { dueFeeds } from '@/lib/workflow/feed-schedule';

interface ApifyTweet {
  // apidojo/tweet-scraper output fields
  text?: string;
  url?: string;
  twitterUrl?: string;
  id?: string;
  likeCount?: number;
  retweetCount?: number;
  createdAt?: string;
  author?: {
    userName?: string;
    name?: string;
    profilePicture?: string;
  };
  // legacy / alternate field names (kept as fallbacks)
  full_text?: string;
  id_str?: string;
  favorite_count?: number;
  retweet_count?: number;
  created_at?: string;
  user?: {
    screen_name?: string;
    name?: string;
    profile_image_url_https?: string;
  };
}

const DEFAULT_TWITTER_ACTOR = 'apidojo~tweet-scraper';

export async function fetchTwitter(workflowRunId?: string): Promise<number> {
  "use step";

  console.log('[fetch-twitter] Starting Twitter/X fetch');
  const apiToken = process.env.APIFY_API_TOKEN;
  if (!apiToken) {
    console.warn('[fetch-twitter] APIFY_API_TOKEN not set, skipping');
    await logIngestEvent({
      workflowRunId,
      step: 'fetch:twitter',
      level: 'warning',
      message: 'X/Twitter scan skipped because APIFY_API_TOKEN is not configured.',
      sourceType: 'twitter',
    });
    return 0;
  }

  const supabase = createServiceClient();

  const { data: feeds, error: feedError } = await supabase
    .from('aitea_feeds')
    .select('*')
    .eq('type', 'twitter')
    .eq('active', true);

  if (feedError || !feeds) {
    throw new Error(`Failed to fetch Twitter feeds: ${feedError?.message}`);
  }

  await logIngestEvent({
    workflowRunId,
    step: 'fetch:twitter',
    message: `Scanning ${feeds.length} X/Twitter feeds via Apify.`,
    sourceType: 'twitter',
    metrics: { feeds: feeds.length },
  });

  const feedsToScan = dueFeeds(feeds as Feed[]);
  const skipped = feeds.length - feedsToScan.length;

  let totalInserted = 0;

  for (const feed of feedsToScan) {
    const config = feed.config as Record<string, unknown>;
    const handle = String(config.handle ?? '').replace('@', '');
    if (!handle) continue;

    try {
      const actor = normalizeActorId(
        config.actor ?? process.env.APIFY_TWITTER_ACTOR,
        DEFAULT_TWITTER_ACTOR
      );
      await logIngestEvent({
        workflowRunId,
        step: 'fetch:twitter:actor',
        message: `Running ${actor} for @${handle}.`,
        sourceType: 'twitter',
        sourceName: `@${handle}`,
        metrics: { actor, handle, maxTweets: 10 },
      });

      const runRes = await fetch(
        `https://api.apify.com/v2/acts/${actor}/run-sync-get-dataset-items?token=${apiToken}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            twitterHandles: [handle],
            maxItems: 10,
            sort: 'Latest',
          }),
        }
      );

      if (!runRes.ok) {
        console.error(`[fetch-twitter] Apify error for @${handle}: ${runRes.status}`);
        await logIngestEvent({
          workflowRunId,
          step: 'fetch:twitter:error',
          level: 'error',
          message: `@${handle}: Apify returned HTTP ${runRes.status}.`,
          sourceType: 'twitter',
          sourceName: `@${handle}`,
          metrics: { actor, status: runRes.status },
        });
        continue;
      }

      const tweets: ApifyTweet[] = await runRes.json();

      const items: NewNewsItem[] = dedupeByCanonicalUrl(tweets
        .filter((t) => t.id ?? t.id_str ?? t.url ?? t.twitterUrl)
        .map((tweet) => {
          const text = tweet.text ?? tweet.full_text ?? '';
          const tweetId = tweet.id ?? tweet.id_str;
          const tweetUrl =
            tweet.url ?? tweet.twitterUrl ?? `https://x.com/${handle}/status/${tweetId}`;
          const canonicalUrl = normalizeContentUrl(tweetUrl) ?? tweetUrl;
          return {
            title: text.length > 140 ? text.slice(0, 137) + '...' : text,
            source_type: 'twitter' as const,
            source_name: `@${handle}`,
            url: canonicalUrl,
            image_url: null,
            summary: text,
            raw_metadata: {
              tweet_id: tweetId ?? null,
              likes: tweet.likeCount ?? tweet.favorite_count ?? 0,
              retweets: tweet.retweetCount ?? tweet.retweet_count ?? 0,
              created_at: tweet.createdAt ?? tweet.created_at ?? null,
              source_url: tweetUrl,
              canonical_url: canonicalUrl,
              feed_id: feed.id,
              apify_actor: actor,
            },
          };
        })
        .filter((item) => item.summary || item.title));

      if (items.length > 0) {
        const { data: inserted, error } = await supabase
          .from('aitea_news_items')
          .upsert(items, { onConflict: 'url', ignoreDuplicates: true })
          .select('id');

        if (!error && inserted) {
          totalInserted += inserted.length;
          await logIngestEvent({
            workflowRunId,
            step: 'fetch:twitter:feed',
            level: 'success',
            message: `@${handle}: ${inserted.length} new posts from ${items.length} candidates.`,
            sourceType: 'twitter',
            sourceName: `@${handle}`,
            metrics: {
              actor,
              returned: tweets.length,
              candidates: items.length,
              inserted: inserted.length,
              words: items.reduce((sum, item) => sum + countWords(item.title, item.summary), 0),
            },
          });
        }
      }

      await supabase
        .from('aitea_feeds')
        .update({ last_fetched_at: new Date().toISOString() })
        .eq('id', feed.id);
    } catch (err) {
      console.error(`[fetch-twitter] Failed for @${handle}:`, err);
      await logIngestEvent({
        workflowRunId,
        step: 'fetch:twitter:error',
        level: 'error',
        message: `@${handle} failed during X/Twitter fetch.`,
        sourceType: 'twitter',
        sourceName: `@${handle}`,
        metrics: { error: String(err) },
      });
    }
  }

  console.log(`[fetch-twitter] Done — inserted ${totalInserted} items`);
  await logIngestEvent({
    workflowRunId,
    step: 'fetch:twitter',
    level: 'success',
    message: `X/Twitter scan complete: ${totalInserted} new posts.`,
    sourceType: 'twitter',
    metrics: { inserted: totalInserted, skippedByCadence: skipped },
  });
  return totalInserted;
}
