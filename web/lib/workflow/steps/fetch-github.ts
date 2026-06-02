import { createServiceClient } from '@/lib/supabase/server';
import type { NewNewsItem } from '@/lib/supabase/types';
import { countWords, logIngestEvent } from '@/lib/workflow/events';

interface TrendingRepo {
  author: string;
  name: string;
  description: string;
  url: string;
  language: string;
  stars: number;
  forks: number;
  currentPeriodStars: number;
  avatar: string;
}

interface GitHubSearchRepo {
  full_name?: string;
  name?: string;
  html_url: string;
  description?: string | null;
  language?: string | null;
  stargazers_count?: number;
  forks_count?: number;
  owner?: { login?: string; avatar_url?: string };
}

export async function fetchGitHub(workflowRunId?: string): Promise<number> {
  "use step";

  console.log('[fetch-github] Starting GitHub trending fetch');
  const supabase = createServiceClient();
  await logIngestEvent({
    workflowRunId,
    step: 'fetch:github',
    message: 'Checking GitHub Trending repositories.',
    sourceType: 'github',
  });

  try {
    // The old third-party trending scrapers (herokuapp/gitterapp) are dead.
    // Use GitHub's own Search API as a robust "trending" proxy: the most-starred
    // repositories created in the last two weeks. No key required, but a
    // GITHUB_TOKEN lifts the rate limit if present.
    const since = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const query = encodeURIComponent(`created:>${since} stars:>25`);
    const headers: Record<string, string> = {
      Accept: 'application/vnd.github+json',
      'User-Agent': 'the-tool-printer',
    };
    if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;

    const res = await fetch(
      `https://api.github.com/search/repositories?q=${query}&sort=stars&order=desc&per_page=25`,
      { headers }
    );

    if (!res.ok) {
      console.error('[fetch-github] GitHub Search API unavailable');
      await logIngestEvent({
        workflowRunId,
        step: 'fetch:github:error',
        level: 'error',
        message: `GitHub Search API returned HTTP ${res.status}.`,
        sourceType: 'github',
        metrics: { status: res.status },
      });
      return 0;
    }

    const payload = (await res.json()) as { items?: GitHubSearchRepo[] };
    const repos: TrendingRepo[] = (payload.items ?? []).map((item) => ({
      author: item.owner?.login ?? item.full_name?.split('/')[0] ?? '',
      name: item.name ?? item.full_name?.split('/')[1] ?? '',
      description: item.description ?? '',
      url: item.html_url,
      language: item.language ?? '',
      stars: item.stargazers_count ?? 0,
      forks: item.forks_count ?? 0,
      currentPeriodStars: item.stargazers_count ?? 0,
      avatar: item.owner?.avatar_url ?? '',
    }));
    return await insertRepos(supabase, repos, workflowRunId, 'github-search');
  } catch (err) {
    console.error('[fetch-github] Fetch failed:', err);
    await logIngestEvent({
      workflowRunId,
      step: 'fetch:github:error',
      level: 'error',
      message: 'GitHub trending fetch failed.',
      sourceType: 'github',
      metrics: { error: String(err) },
    });
    return 0;
  }
}

async function insertRepos(
  supabase: ReturnType<typeof createServiceClient>,
  repos: TrendingRepo[],
  workflowRunId?: string,
  apiName = 'primary'
): Promise<number> {
  const items: NewNewsItem[] = repos.slice(0, 25).map((repo) => ({
    title: `${repo.author}/${repo.name}`,
    source_type: 'github' as const,
    source_name: 'GitHub Trending',
    url: repo.url || `https://github.com/${repo.author}/${repo.name}`,
    image_url: repo.avatar || null,
    summary: repo.description || null,
    raw_metadata: {
      language: repo.language,
      stars: repo.stars,
      forks: repo.forks,
      stars_today: repo.currentPeriodStars,
    },
  }));

  if (items.length === 0) return 0;

  const { data, error } = await supabase
    .from('aitea_news_items')
    .upsert(items, { onConflict: 'url', ignoreDuplicates: true })
    .select('id');

  if (error) {
    console.error('[fetch-github] Insert error:', error.message);
    await logIngestEvent({
      workflowRunId,
      step: 'fetch:github:error',
      level: 'error',
      message: 'GitHub repository insert failed.',
      sourceType: 'github',
      metrics: { error: error.message, candidates: items.length },
    });
    return 0;
  }

  console.log(`[fetch-github] Done — inserted ${data?.length ?? 0} repos`);
  await logIngestEvent({
    workflowRunId,
    step: 'fetch:github',
    level: 'success',
    message: `GitHub Trending complete: ${data?.length ?? 0} new repos from ${items.length} candidates.`,
    sourceType: 'github',
    sourceName: 'GitHub Trending',
    metrics: {
      api: apiName,
      returned: repos.length,
      candidates: items.length,
      inserted: data?.length ?? 0,
      words: items.reduce((sum, item) => sum + countWords(item.title, item.summary), 0),
    },
  });
  return data?.length ?? 0;
}
