import { start } from 'workflow/api';
import { checkAuth } from '@/lib/auth/admin';
import { createServiceClient } from '@/lib/supabase/server';
import { ingestWorkflow, type IngestOptions, type IngestPhases } from '@/lib/workflow/ingest';

function normalizePhases(value: unknown): IngestPhases {
  const phases = value && typeof value === 'object' ? value as Partial<Record<keyof IngestPhases, unknown>> : {};
  const normalized = {
    fetch: phases.fetch === true,
    score: phases.score === true,
    route: phases.route === true,
    images: phases.images === true,
  };

  if (!normalized.fetch && !normalized.score && !normalized.route && !normalized.images) {
    return { fetch: false, score: true, route: true, images: false };
  }

  return normalized;
}

function normalizeQueueItemLimit(value: unknown): number | null {
  const numeric = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(numeric)) return null;
  return Math.max(1, Math.min(500, Math.floor(numeric)));
}

export async function POST(req: Request) {
  if (!(await checkAuth())) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: { phases?: unknown; queueItemLimit?: unknown };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const supabase = createServiceClient();
  const phases = normalizePhases(body.phases);
  const queueItemLimit = normalizeQueueItemLimit(body.queueItemLimit);
  const options: IngestOptions = { queueItemLimit };
  const recentRunningCutoff = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();

  await supabase
    .from('aitea_workflow_runs')
    .update({
      status: 'failed',
      completed_at: new Date().toISOString(),
      errors: [
        {
          source: 'admin-recovery',
          message: 'Marked stale running workflow failed before starting a fresh manual run.',
        },
      ],
    })
    .eq('status', 'running')
    .is('completed_at', null)
    .lt('started_at', recentRunningCutoff);

  const { data: activeRun } = await supabase
    .from('aitea_workflow_runs')
    .select('workflow_run_id, status')
    .eq('status', 'running')
    .is('completed_at', null)
    .gte('started_at', recentRunningCutoff)
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (activeRun?.workflow_run_id) {
    return Response.json({
      ok: true,
      alreadyRunning: true,
      controlRunId: activeRun.workflow_run_id,
      workflowRunId: null,
      phases,
      queueItemLimit,
    });
  }

  const controlRunId = crypto.randomUUID();
  await supabase
    .from('aitea_knowledge_blocks')
    .upsert(
      {
        category: 'ingest_control',
        title: 'Ingest Control',
        content_json: {
          stopRequested: false,
          activeControlRunId: controlRunId,
          phases,
          queueItemLimit,
          updatedAt: new Date().toISOString(),
        },
        sort_order: 3,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'category' }
    );

  const run = await start(ingestWorkflow, [controlRunId, phases, options]);
  await supabase
    .from('aitea_knowledge_blocks')
    .upsert(
      {
        category: 'ingest_control',
        title: 'Ingest Control',
        content_json: {
          stopRequested: false,
          activeControlRunId: controlRunId,
          workflowRunId: run.runId,
          phases,
          queueItemLimit,
          updatedAt: new Date().toISOString(),
        },
        sort_order: 3,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'category' }
    );

  return Response.json({
    ok: true,
    alreadyRunning: false,
    controlRunId,
    workflowRunId: run.runId,
    phases,
    queueItemLimit,
  });
}
