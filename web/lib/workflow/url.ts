const TRACKING_PARAMS = new Set([
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_term',
  'utm_content',
  'utm_id',
  'gclid',
  'fbclid',
  'mc_cid',
  'mc_eid',
  'igshid',
  'mkt_tok',
  'si',
  'feature',
  'ab_channel',
  'pp',
  't',
  'ref',
  'ref_src',
  'ref_url',
  'source',
  'trackingId',
  'trk',
  'trkCampaign',
]);

export function normalizeActorId(value: unknown, fallback: string): string {
  const raw = typeof value === 'string' ? value.trim() : '';
  return (raw || fallback).replace('/', '~');
}

export function normalizeContentUrl(input: string | null | undefined): string | null {
  if (!input) return null;

  try {
    const url = new URL(input.trim());
    url.hash = '';
    url.hostname = url.hostname.toLowerCase().replace(/^www\./, '');
    url.username = '';
    url.password = '';

    for (const key of Array.from(url.searchParams.keys())) {
      if (TRACKING_PARAMS.has(key)) {
        url.searchParams.delete(key);
      }
    }

    if (url.hostname === 'youtu.be') {
      const videoId = url.pathname.replace(/^\/+/, '').split('/')[0];
      if (videoId) {
        url.hostname = 'youtube.com';
        url.pathname = '/watch';
        url.search = '';
        url.searchParams.set('v', videoId);
      }
    } else if (url.hostname.endsWith('youtube.com')) {
      const embedded = url.pathname.match(/^\/(shorts|embed|v)\/([^/]+)/);
      const currentId = url.searchParams.get('v');
      if (embedded?.[2]) {
        url.hostname = 'youtube.com';
        url.pathname = '/watch';
        url.search = '';
        url.searchParams.set('v', embedded[2]);
      } else if (currentId) {
        url.hostname = 'youtube.com';
        url.pathname = '/watch';
        url.search = '';
        url.searchParams.set('v', currentId);
      }
    }

    if (url.pathname.length > 1 && url.pathname.endsWith('/')) {
      url.pathname = url.pathname.replace(/\/+$/, '');
    }

    return url.toString();
  } catch {
    return null;
  }
}

export function dedupeByCanonicalUrl<T extends { url: string }>(items: T[]): T[] {
  const seen = new Set<string>();
  const deduped: T[] = [];

  for (const item of items) {
    const canonical = normalizeContentUrl(item.url) ?? item.url;
    if (seen.has(canonical)) continue;
    seen.add(canonical);
    deduped.push({ ...item, url: canonical });
  }

  return deduped;
}
