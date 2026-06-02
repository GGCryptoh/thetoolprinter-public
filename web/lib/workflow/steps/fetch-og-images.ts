import { createServiceClient } from '@/lib/supabase/server';
import { logIngestEvent } from '@/lib/workflow/events';

export async function fetchOGImages(workflowRunId?: string, limit = 30): Promise<number> {
  "use step";

  console.log('[fetch-og-images] Starting OG image fetch');
  const supabase = createServiceClient();

  const { data: items, error } = await supabase
    .from('aitea_news_items')
    .select('id, url, image_url')
    .is('image_url', null)
    .neq('status', 'rejected')
    .is('archived_at', null)
    .in('source_type', ['rss', 'linkedin'])
    .order('created_at', { ascending: false })
    .limit(Math.max(1, Math.min(500, Math.floor(limit))));

  if (error || !items || items.length === 0) {
    console.log('[fetch-og-images] No items need images');
    await logIngestEvent({
      workflowRunId,
      step: 'images',
      message: 'No eligible RSS items need OG images.',
    });
    return 0;
  }

  await logIngestEvent({
    workflowRunId,
    step: 'images',
    message: `Checking OG images for ${items.length} RSS items.`,
    metrics: { candidates: items.length },
  });

  let fetched = 0;

  for (const item of items) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);

      const res = await fetch(item.url, {
        signal: controller.signal,
        headers: { 'User-Agent': 'AItea/1.0 (og-image-fetcher)' },
        redirect: 'follow',
      });
      clearTimeout(timeout);

      if (!res.ok) continue;

      const html = await res.text();
      const ogImage = extractOGImage(html);

      if (ogImage) {
        await supabase
          .from('aitea_news_items')
          .update({ image_url: ogImage })
          .eq('id', item.id);
        fetched++;
        console.log(`[fetch-og-images] Got image for: ${item.url}`);
      }
    } catch {
      // Timeout or fetch error — skip silently
    }
  }

  console.log(`[fetch-og-images] Done — fetched ${fetched} images`);
  await logIngestEvent({
    workflowRunId,
    step: 'images',
    level: 'success',
    message: `Fetched ${fetched} OG images.`,
    metrics: { fetched, candidates: items.length },
  });
  return fetched;
}

function extractOGImage(html: string): string | null {
  // Match og:image meta tag — handles both property and name attributes
  const match = html.match(
    /<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i
  ) ?? html.match(
    /<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:image["']/i
  );

  if (!match?.[1]) return null;

  let url = match[1];
  // Decode HTML entities
  url = url.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');

  // Basic validation
  if (!url.startsWith('http')) return null;

  return url;
}
