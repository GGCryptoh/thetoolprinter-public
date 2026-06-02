import { createServiceClient } from '@/lib/supabase/server';
import type { Feed, NewNewsItem } from '@/lib/supabase/types';
import { countWords, logIngestEvent } from '@/lib/workflow/events';
import { dueFeeds } from '@/lib/workflow/feed-schedule';
import { dedupeByCanonicalUrl, normalizeActorId, normalizeContentUrl } from '@/lib/workflow/url';

interface ApifyLinkedInPost {
  text?: string;
  content?: string;
  commentary?: string;
  headline?: string;
  title?: string;
  url?: string;
  postUrl?: string;
  link?: string;
  imageUrl?: string;
  authorName?: string;
  profileName?: string;
  postedAt?: string;
  date?: string;
  datePublished?: string;
  reactionsCount?: number;
  likeCount?: number;
  commentsCount?: number;
  shareCount?: number;
  urn?: string;
  id?: string;
}

// Default to the no-cookies "LinkedIn Post Scraper" ($1/1k). The older
// curious_coder search scraper needs session cookies and returns HTTP 403
// without them, so it is no longer a safe default.
const DEFAULT_LINKEDIN_ACTOR = 'supreme_coder~linkedin-post';

function inputForLinkedInActor(actor: string, profileUrl: string, maxPosts: number, config: Record<string, unknown>) {
  const customInput = config.actorInput;
  if (customInput && typeof customInput === 'object' && !Array.isArray(customInput)) {
    return {
      ...customInput,
      maxItems: maxPosts,
      maxResults: maxPosts,
      limit: maxPosts,
    };
  }

  // supreme_coder/linkedin-post: { urls: [...], limitPerSource, deepScrape }
  if (actor === 'supreme_coder~linkedin-post') {
    return {
      urls: [profileUrl],
      limitPerSource: maxPosts,
      deepScrape: true,
    };
  }

  if (actor === 'curious_coder~linkedin-post-search-scraper') {
    return {
      profileUrls: [profileUrl],
      urls: [profileUrl],
      maxItems: maxPosts,
      maxResults: maxPosts,
    };
  }

  return {
    startUrls: [{ url: profileUrl }],
    profileUrls: [profileUrl],
    maxItems: maxPosts,
    maxResults: maxPosts,
    limit: maxPosts,
  };
}

function postText(post: ApifyLinkedInPost) {
  return post.text ?? post.content ?? post.commentary ?? post.headline ?? post.title ?? '';
}

function postUrl(post: ApifyLinkedInPost, profileUrl: string) {
  if (post.postUrl || post.url || post.link) return post.postUrl ?? post.url ?? post.link ?? profileUrl;
  if (post.urn) return `https://www.linkedin.com/feed/update/${post.urn}`;
  if (post.id) return `${profileUrl.replace(/\/+$/, '')}/recent-activity/all/${post.id}`;
  return `${profileUrl.replace(/\/+$/, '')}#${encodeURIComponent(postText(post).slice(0, 60))}`;
}

export async function fetchLinkedIn(workflowRunId?: string): Promise<number> {
  "use step";

  console.log('[fetch-linkedin] Starting LinkedIn fetch via Apify');
  const apiToken = process.env.APIFY_API_TOKEN;
  if (!apiToken) {
    console.warn('[fetch-linkedin] APIFY_API_TOKEN not set, skipping');
    await logIngestEvent({
      workflowRunId,
      step: 'fetch:linkedin',
      level: 'warning',
      message: 'LinkedIn scan skipped because APIFY_API_TOKEN is not configured.',
      sourceType: 'linkedin',
    });
    return 0;
  }

  const supabase = createServiceClient();
  const { data: feeds, error: feedError } = await supabase
    .from('aitea_feeds')
    .select('*')
    .eq('type', 'linkedin')
    .eq('active', true);

  if (feedError || !feeds) {
    throw new Error(`Failed to fetch LinkedIn feeds: ${feedError?.message}`);
  }

  const feedsToScan = dueFeeds(feeds as Feed[]);
  const skipped = feeds.length - feedsToScan.length;

  await logIngestEvent({
    workflowRunId,
    step: 'fetch:linkedin',
    message: `Scanning ${feedsToScan.length} LinkedIn feeds via Apify.`,
    sourceType: 'linkedin',
    metrics: { feeds: feeds.length, due: feedsToScan.length, skippedByCadence: skipped },
  });

  let totalInserted = 0;

  for (const feed of feedsToScan) {
    const profileUrl = feed.url;
    const config = feed.config as Record<string, unknown>;
    const actor = normalizeActorId(config.actor ?? process.env.APIFY_LINKEDIN_ACTOR, DEFAULT_LINKEDIN_ACTOR);
    const maxPosts = Number(config.maxPosts ?? config.maxResults ?? 10);

    try {
      await logIngestEvent({
        workflowRunId,
        step: 'fetch:linkedin:actor',
        message: `Running ${actor} for ${feed.name}.`,
        sourceType: 'linkedin',
        sourceName: feed.name,
        metrics: { actor, maxPosts, profileUrl },
      });

      const runRes = await fetch(
        `https://api.apify.com/v2/acts/${actor}/run-sync-get-dataset-items?token=${apiToken}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(inputForLinkedInActor(actor, profileUrl, maxPosts || 10, config)),
        }
      );

      if (!runRes.ok) {
        await logIngestEvent({
          workflowRunId,
          step: 'fetch:linkedin:error',
          level: 'error',
          message: `${feed.name}: Apify returned HTTP ${runRes.status}.`,
          sourceType: 'linkedin',
          sourceName: feed.name,
          metrics: { actor, status: runRes.status },
        });
        continue;
      }

      const posts: ApifyLinkedInPost[] = await runRes.json();
      const items: NewNewsItem[] = dedupeByCanonicalUrl(posts
        .map((post) => {
          const text = postText(post).trim();
          const sourceUrl = postUrl(post, profileUrl);
          const canonicalUrl = normalizeContentUrl(sourceUrl) ?? sourceUrl;
          const title = text.length > 140 ? `${text.slice(0, 137)}...` : text || `LinkedIn post from ${feed.name}`;

          return {
            title,
            source_type: 'linkedin' as const,
            source_name: post.authorName ?? post.profileName ?? feed.name,
            url: canonicalUrl,
            image_url: post.imageUrl ?? null,
            summary: text || null,
            raw_metadata: {
              post_id: post.id ?? post.urn ?? null,
              published_at: post.postedAt ?? post.datePublished ?? post.date ?? null,
              reactions: post.reactionsCount ?? post.likeCount ?? null,
              comments: post.commentsCount ?? null,
              shares: post.shareCount ?? null,
              source_url: sourceUrl,
              canonical_url: canonicalUrl,
              feed_id: feed.id,
              profile_url: profileUrl,
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
            step: 'fetch:linkedin:feed',
            level: 'success',
            message: `${feed.name}: ${inserted.length} new LinkedIn posts from ${items.length} candidates.`,
            sourceType: 'linkedin',
            sourceName: feed.name,
            metrics: {
              actor,
              returned: posts.length,
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
      console.error(`[fetch-linkedin] Failed for ${feed.name}:`, err);
      await logIngestEvent({
        workflowRunId,
        step: 'fetch:linkedin:error',
        level: 'error',
        message: `${feed.name} failed during LinkedIn fetch.`,
        sourceType: 'linkedin',
        sourceName: feed.name,
        metrics: { error: String(err) },
      });
    }
  }

  await logIngestEvent({
    workflowRunId,
    step: 'fetch:linkedin',
    level: 'success',
    message: `LinkedIn scan complete: ${totalInserted} new posts.`,
    sourceType: 'linkedin',
    metrics: { inserted: totalInserted, skippedByCadence: skipped },
  });
  return totalInserted;
}
