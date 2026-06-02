import { createServiceClient } from '@/lib/supabase/server';
import type { IngestEventLevel, SourceType } from '@/lib/supabase/types';

type IngestEventInput = {
  workflowRunId?: string | null;
  step: string;
  level?: IngestEventLevel;
  message: string;
  sourceType?: SourceType | null;
  sourceName?: string | null;
  itemId?: string | null;
  metrics?: Record<string, unknown>;
};

export async function logIngestEvent({
  workflowRunId,
  step,
  level = 'info',
  message,
  sourceType = null,
  sourceName = null,
  itemId = null,
  metrics = {},
}: IngestEventInput) {
  const supabase = createServiceClient();

  const { error } = await supabase.from('aitea_ingest_events').insert({
    workflow_run_id: workflowRunId ?? null,
    step,
    level,
    message,
    source_type: sourceType,
    source_name: sourceName,
    item_id: itemId,
    metrics,
  });

  if (error) {
    console.warn(`[ingest-event] ${step}: ${message}`, error.message);
  }
}

export function countWords(...values: Array<string | null | undefined>) {
  return values.join(' ').trim().split(/\s+/).filter(Boolean).length;
}
