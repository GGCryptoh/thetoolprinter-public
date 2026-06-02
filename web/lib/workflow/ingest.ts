import { createServiceClient } from '@/lib/supabase/server';
import { fetchRSS } from './steps/fetch-rss';
import { fetchYouTube } from './steps/fetch-youtube';
import { fetchTwitter } from './steps/fetch-twitter';
import { fetchLinkedIn } from './steps/fetch-linkedin';
import { fetchGitHub } from './steps/fetch-github';
import { scoreNewItems } from './steps/score-items';
import { routeItems } from './steps/route-items';
import { fetchOGImages } from './steps/fetch-og-images';
import { getFrontPageController } from '@/lib/front-page/controller';
import { logIngestEvent } from '@/lib/workflow/events';

export type IngestPhases = {
  fetch: boolean;
  score: boolean;
  route: boolean;
  images: boolean;
};

export type IngestOptions = {
  queueItemLimit?: number | null;
};

export const DEFAULT_INGEST_PHASES: IngestPhases = {
  fetch: true,
  score: true,
  route: true,
  images: true,
};

function normalizeQueueItemLimit(value?: number | null) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  return Math.max(1, Math.min(500, Math.floor(value)));
}

function normalizePhases(phases?: Partial<IngestPhases> | null): IngestPhases {
  return {
    fetch: phases?.fetch ?? DEFAULT_INGEST_PHASES.fetch,
    score: phases?.score ?? DEFAULT_INGEST_PHASES.score,
    route: phases?.route ?? DEFAULT_INGEST_PHASES.route,
    images: phases?.images ?? DEFAULT_INGEST_PHASES.images,
  };
}

async function logRun(
  workflowRunId: string | undefined,
  status: 'running' | 'completed' | 'failed',
  stats: { items_fetched: number; items_scored: number },
  errors: unknown[]
) {
  "use step";

  console.log(`[log-run] Logging workflow run: ${status}`);
  const supabase = createServiceClient();

  if (status === 'running') {
    await supabase.from('aitea_workflow_runs').insert({
      workflow_run_id: workflowRunId ?? null,
      status,
      items_fetched: 0,
      items_scored: 0,
      errors: [],
    });
  } else {
    await supabase
      .from('aitea_workflow_runs')
      .update({
        status,
        items_fetched: stats.items_fetched,
        items_scored: stats.items_scored,
        errors,
        completed_at: new Date().toISOString(),
      })
      .eq('workflow_run_id', workflowRunId);
  }
}

async function setStopRequested(stopRequested: boolean) {
  "use step";

  const supabase = createServiceClient();
  await supabase
    .from('aitea_knowledge_blocks')
    .upsert(
      {
        category: 'ingest_control',
        title: 'Ingest Control',
        content_json: {
          stopRequested,
          updatedAt: new Date().toISOString(),
        },
        sort_order: 3,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'category' }
    );
}

async function isStopRequested() {
  "use step";

  const supabase = createServiceClient();
  const { data } = await supabase
    .from('aitea_knowledge_blocks')
    .select('content_json')
    .eq('category', 'ingest_control')
    .maybeSingle();

  const control = data?.content_json as { stopRequested?: boolean } | null;
  return control?.stopRequested === true;
}

async function getWorkflowController() {
  "use step";

  return getFrontPageController();
}

export async function ingestWorkflow(
  controlRunId?: string,
  requestedPhases?: Partial<IngestPhases>,
  options?: IngestOptions
) {
  "use workflow";

  const runId = controlRunId ?? crypto.randomUUID();
  const phases = normalizePhases(requestedPhases);
  const queueItemLimit = normalizeQueueItemLimit(options?.queueItemLimit);
  await setStopRequested(false);
  await logRun(runId, 'running', { items_fetched: 0, items_scored: 0 }, []);
  await logIngestEvent({
    workflowRunId: runId,
    step: 'controller',
    message: 'Manual or scheduled pipeline run started.',
    metrics: { runId, phases, queueItemLimit },
  });

  const errors: unknown[] = [];
  const controller = await getWorkflowController();

  if (!controller.aiUpdatesEnabled) {
    await logIngestEvent({
      workflowRunId: runId,
      step: 'controller',
      level: 'warning',
      message: 'AI updates are disabled in /admin/controller; ingest skipped.',
    });
    await logRun(runId, 'completed', { items_fetched: 0, items_scored: 0 }, [
      { source: 'controller', message: 'AI updates are disabled in /admin/controller' },
    ]);
    return { totalFetched: 0, totalScored: 0, errors: [] };
  }

  let totalFetched = 0;
  if (phases.fetch) {
    const [rssCount, youtubeCount, twitterCount, linkedinCount, githubCount] = await Promise.all([
      fetchRSS(runId).catch(async (err) => {
        errors.push({ source: 'rss', error: String(err) });
        await logIngestEvent({
          workflowRunId: runId,
          step: 'fetch:rss:error',
          level: 'error',
          message: 'RSS source scan failed.',
          sourceType: 'rss',
          metrics: { error: String(err) },
        });
        return 0;
      }),
      fetchYouTube(runId).catch(async (err) => {
        errors.push({ source: 'youtube', error: String(err) });
        await logIngestEvent({
          workflowRunId: runId,
          step: 'fetch:youtube:error',
          level: 'error',
          message: 'YouTube source scan failed.',
          sourceType: 'youtube',
          metrics: { error: String(err) },
        });
        return 0;
      }),
      fetchTwitter(runId).catch(async (err) => {
        errors.push({ source: 'twitter', error: String(err) });
        await logIngestEvent({
          workflowRunId: runId,
          step: 'fetch:twitter:error',
          level: 'error',
          message: 'X/Twitter source scan failed.',
          sourceType: 'twitter',
          metrics: { error: String(err) },
        });
        return 0;
      }),
      fetchLinkedIn(runId).catch(async (err) => {
        errors.push({ source: 'linkedin', error: String(err) });
        await logIngestEvent({
          workflowRunId: runId,
          step: 'fetch:linkedin:error',
          level: 'error',
          message: 'LinkedIn source scan failed.',
          sourceType: 'linkedin',
          metrics: { error: String(err) },
        });
        return 0;
      }),
      fetchGitHub(runId).catch(async (err) => {
        errors.push({ source: 'github', error: String(err) });
        await logIngestEvent({
          workflowRunId: runId,
          step: 'fetch:github:error',
          level: 'error',
          message: 'GitHub source scan failed.',
          sourceType: 'github',
          metrics: { error: String(err) },
        });
        return 0;
      }),
    ]);

    totalFetched = rssCount + youtubeCount + twitterCount + linkedinCount + githubCount;
    await logIngestEvent({
      workflowRunId: runId,
      step: 'fetch',
      level: 'success',
      message: `Fetch phase complete: ${totalFetched} new items.`,
      metrics: { rssCount, youtubeCount, twitterCount, linkedinCount, githubCount, totalFetched },
    });
  } else {
    await logIngestEvent({
      workflowRunId: runId,
      step: 'fetch',
      message: 'Fetch phase skipped by manual run selection.',
      metrics: { phases },
    });
  }

  if (await isStopRequested()) {
    await logIngestEvent({
      workflowRunId: runId,
      step: 'stop',
      level: 'warning',
      message: 'Stop requested after fetch; skipping scoring and routing.',
      metrics: { totalFetched },
    });
    await logRun(runId, 'completed', { items_fetched: totalFetched, items_scored: 0 }, [
      { source: 'controller', message: 'Stop requested from /admin/operations' },
    ]);
    await setStopRequested(false);
    return { totalFetched, totalScored: 0, errors };
  }

  // Score new items
  let totalScored = 0;
  if (phases.score) {
    try {
      totalScored = await scoreNewItems(queueItemLimit ?? controller.scoreLimitPerRun, controller.qualityPromptType, runId);
    } catch (err) {
      errors.push({ source: 'scoring', error: String(err) });
    }
  } else {
    await logIngestEvent({
      workflowRunId: runId,
      step: 'score',
      message: 'Quality scoring skipped by manual run selection.',
      metrics: { phases },
    });
  }

  if (await isStopRequested()) {
    await logIngestEvent({
      workflowRunId: runId,
      step: 'stop',
      level: 'warning',
      message: 'Stop requested after scoring; skipping routing and image enrichment.',
      metrics: { totalFetched, totalScored },
    });
    await logRun(runId, 'completed', { items_fetched: totalFetched, items_scored: totalScored }, [
      { source: 'controller', message: 'Stop requested after scoring' },
      ...errors,
    ]);
    await setStopRequested(false);
    return { totalFetched, totalScored, errors };
  }

  // Route scored items by threshold
  if (phases.route) {
    try {
      await routeItems(runId, queueItemLimit ?? undefined);
    } catch (err) {
      errors.push({ source: 'routing', error: String(err) });
    }
  } else {
    await logIngestEvent({
      workflowRunId: runId,
      step: 'route',
      message: 'Routing skipped by manual run selection.',
      metrics: { phases },
    });
  }

  // Fetch OG images for items that don't have one
  if (phases.images) {
    try {
      await fetchOGImages(runId, queueItemLimit ?? undefined);
    } catch (err) {
      errors.push({ source: 'og-images', error: String(err) });
    }
  } else {
    await logIngestEvent({
      workflowRunId: runId,
      step: 'og-images',
      message: 'Image enrichment skipped by manual run selection.',
      metrics: { phases },
    });
  }

  // Log completion
  const finalStatus = errors.length > 0 ? 'failed' : 'completed';
  await logRun(runId, finalStatus as 'completed' | 'failed', {
    items_fetched: totalFetched,
    items_scored: totalScored,
  }, errors);
  await logIngestEvent({
    workflowRunId: runId,
    step: 'complete',
    level: finalStatus === 'completed' ? 'success' : 'error',
    message: `Pipeline ${finalStatus}: ${totalFetched} fetched, ${totalScored} scored.`,
    metrics: { totalFetched, totalScored, errors: errors.length, phases, queueItemLimit },
  });
  await setStopRequested(false);

  return { totalFetched, totalScored, errors };
}
