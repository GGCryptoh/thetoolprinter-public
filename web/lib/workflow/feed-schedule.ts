import type { Feed } from '@/lib/supabase/types';

export function feedCadenceHours(feed: Feed): number | null {
  const config = feed.config as Record<string, unknown>;
  const raw = config.cadenceHours ?? config.everyHours ?? config.scheduleHours;
  const value = Number(raw);
  return Number.isFinite(value) && value > 0 ? value : null;
}

export function feedIsDue(feed: Feed, now = new Date()) {
  const cadenceHours = feedCadenceHours(feed);
  if (!cadenceHours || !feed.last_fetched_at) return true;

  const lastFetched = new Date(feed.last_fetched_at).getTime();
  if (!Number.isFinite(lastFetched)) return true;

  return now.getTime() - lastFetched >= cadenceHours * 60 * 60 * 1000;
}

export function dueFeeds(feeds: Feed[], now = new Date()) {
  return feeds.filter((feed) => feedIsDue(feed, now));
}
