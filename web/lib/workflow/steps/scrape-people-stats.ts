import { createServiceClient } from '@/lib/supabase/server';

interface ApifyTwitterUser {
  followers_count?: number;
  friends_count?: number;
  statuses_count?: number;
  profile_image_url_https?: string;
  favourites_count?: number;
  screen_name?: string;
  name?: string;
  [key: string]: unknown;
}

interface ApifyYouTubeChannel {
  subscriberCount?: number;
  videoCount?: number;
  viewCount?: number;
  thumbnailUrl?: string;
  channelName?: string;
  [key: string]: unknown;
}

interface Person {
  id: string;
  name: string;
  handle: string;
  avatar_url: string | null;
  description: string | null;
  tags: string[];
  sort_order: number | null;
  active: boolean;
  created_at: string;
  url: string | null;
}

function isYouTubePerson(person: Person): boolean {
  if (person.url && person.url.includes('youtube.com')) return true;
  if (person.tags?.some((t) => t.toLowerCase().includes('youtube'))) return true;
  return false;
}

function extractTwitterHandle(person: Person): string | null {
  // Use the handle field directly — strip @ prefix if present
  if (person.handle) {
    return person.handle.replace(/^@/, '');
  }
  return null;
}

function extractYouTubeChannelUrl(person: Person): string | null {
  if (person.url && person.url.includes('youtube.com')) {
    return person.url;
  }
  if (person.handle && person.handle.includes('youtube.com')) {
    return person.handle;
  }
  return null;
}

async function scrapeTwitterUser(
  handle: string,
  apiToken: string
): Promise<ApifyTwitterUser | null> {
  try {
    const res = await fetch(
      `https://api.apify.com/v2/acts/apidojo~twitter-user-scraper/run-sync-get-dataset-items?token=${apiToken}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ handles: [handle], maxItems: 1 }),
      }
    );

    if (!res.ok) {
      console.error(`[scrape-people-stats] Apify Twitter error for @${handle}: ${res.status}`);
      return null;
    }

    const results: ApifyTwitterUser[] = await res.json();
    return results[0] ?? null;
  } catch (err) {
    console.error(`[scrape-people-stats] Twitter scrape failed for @${handle}:`, err);
    return null;
  }
}

async function scrapeYouTubeChannel(
  channelUrl: string,
  apiToken: string
): Promise<ApifyYouTubeChannel | null> {
  try {
    const res = await fetch(
      `https://api.apify.com/v2/acts/bernardo~youtube-scraper/run-sync-get-dataset-items?token=${apiToken}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          startUrls: [{ url: channelUrl }],
          maxResults: 1,
          type: 'channel',
        }),
      }
    );

    if (!res.ok) {
      console.error(`[scrape-people-stats] Apify YouTube error for ${channelUrl}: ${res.status}`);
      return null;
    }

    const results: ApifyYouTubeChannel[] = await res.json();
    return results[0] ?? null;
  } catch (err) {
    console.error(`[scrape-people-stats] YouTube scrape failed for ${channelUrl}:`, err);
    return null;
  }
}

export async function scrapePeopleStats(): Promise<number> {
  "use step";

  console.log('[scrape-people-stats] Starting people stats scrape');
  const apiToken = process.env.APIFY_API_TOKEN;
  if (!apiToken) {
    console.warn('[scrape-people-stats] APIFY_API_TOKEN not set, skipping');
    return 0;
  }

  const supabase = createServiceClient();

  const { data: people, error: peopleError } = await supabase
    .from('aitea_people')
    .select('*')
    .eq('active', true);

  if (peopleError || !people) {
    throw new Error(`Failed to fetch people: ${peopleError?.message}`);
  }

  let totalScraped = 0;

  for (const person of people as Person[]) {
    try {
      if (isYouTubePerson(person)) {
        const channelUrl = extractYouTubeChannelUrl(person);
        if (!channelUrl) {
          console.warn(`[scrape-people-stats] No YouTube URL for ${person.name}, skipping`);
          continue;
        }

        const data = await scrapeYouTubeChannel(channelUrl, apiToken);
        if (!data) continue;

        await supabase.from('aitea_people_stats').insert({
          person_id: person.id,
          followers: data.subscriberCount ?? null,
          following: null,
          posts_count: data.videoCount ?? null,
          avg_engagement: null,
          raw_data: data,
        });

        // Update avatar if a newer one is found
        if (data.thumbnailUrl && data.thumbnailUrl !== person.avatar_url) {
          await supabase
            .from('aitea_people')
            .update({ avatar_url: data.thumbnailUrl })
            .eq('id', person.id);
        }

        totalScraped++;
      } else {
        // Default to Twitter/X
        const handle = extractTwitterHandle(person);
        if (!handle) {
          console.warn(`[scrape-people-stats] No handle for ${person.name}, skipping`);
          continue;
        }

        const data = await scrapeTwitterUser(handle, apiToken);
        if (!data) continue;

        const engagement =
          data.favourites_count && data.statuses_count && data.statuses_count > 0
            ? Number((data.favourites_count / data.statuses_count).toFixed(2))
            : null;

        await supabase.from('aitea_people_stats').insert({
          person_id: person.id,
          followers: data.followers_count ?? null,
          following: data.friends_count ?? null,
          posts_count: data.statuses_count ?? null,
          avg_engagement: engagement,
          raw_data: data,
        });

        // Update avatar if a newer one is found
        if (data.profile_image_url_https && data.profile_image_url_https !== person.avatar_url) {
          await supabase
            .from('aitea_people')
            .update({ avatar_url: data.profile_image_url_https })
            .eq('id', person.id);
        }

        totalScraped++;
      }
    } catch (err) {
      console.error(`[scrape-people-stats] Failed for ${person.name}:`, err);
    }
  }

  console.log(`[scrape-people-stats] Done — scraped ${totalScraped} people`);
  return totalScraped;
}
