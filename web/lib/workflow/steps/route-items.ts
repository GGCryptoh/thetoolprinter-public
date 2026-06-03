import { createServiceClient } from '@/lib/supabase/server';
import { DEFAULT_THRESHOLDS, routeByScore } from '@/lib/scoring/threshold';
import type { NewsItem } from '@/lib/supabase/types';
import { getFrontPageController } from '@/lib/front-page/controller';
import { logIngestEvent } from '@/lib/workflow/events';

export async function routeItems(workflowRunId?: string, limit = 500): Promise<number> {
  "use step";

  console.log('[route-items] Starting threshold routing');
  const supabase = createServiceClient();

  // Pick up ALL scored pending items, including ones routed in a previous run
  // that exceeded the hybrid per-run auto-approve cap (they keep status
  // 'pending' but already have a section). Re-evaluating them every run lets
  // the cap overflow drain instead of stranding above-threshold items in the
  // review queue forever.
  const { data: items, error } = await supabase
    .from('aitea_news_items')
    .select('*')
    .not('score', 'is', null)
    .eq('status', 'pending')
    .is('archived_at', null)
    .order('scored_at', { ascending: true })
    .limit(Math.max(1, Math.min(500, Math.floor(limit))));

  if (error || !items || items.length === 0) {
    console.log('[route-items] No items to route');
    await logIngestEvent({
      workflowRunId,
      step: 'route',
      message: 'No scored items needed routing.',
    });
    return 0;
  }

  let totalRouted = 0;
  let approved = 0;
  let rejected = 0;
  let review = 0;
  const controller = await getFrontPageController();

  for (const item of items as NewsItem[]) {
    if (item.score === null) continue;

    const section = routeByScore(item.score).section;
    let status: NewsItem['status'] = 'pending';

    // Auto-reject below the floor in every mode (including human) so junk never
    // clogs the review queue. Auto-approve only happens in hybrid/automatic;
    // human mode leaves the rest pending for manual approval.
    if (item.score <= controller.autoRejectThreshold) {
      status = 'rejected';
    } else if (
      controller.publishingGateMode !== 'human' &&
      item.score >= controller.autoApproveThreshold &&
      (controller.publishingGateMode === 'automatic' || approved < controller.maxAutoApprovedPerRun)
    ) {
      status = 'approved';
    }

    const effectiveSection = section ?? (status === 'approved' ? DEFAULT_THRESHOLDS.signalsMin <= item.score ? 'signals' : null : null);

    // Re-scanned items that stay pending with an unchanged section need no
    // write — skip them so hourly runs don't churn the review queue.
    if (status === 'pending' && item.section === effectiveSection) {
      review++;
      continue;
    }

    await supabase
      .from('aitea_news_items')
      .update({
        section: effectiveSection,
        status,
        reviewed_at: status === 'approved' || status === 'rejected' ? new Date().toISOString() : null,
      })
      .eq('id', item.id);

    if (status === 'approved') approved++;
    if (status === 'rejected') rejected++;
    if (status === 'pending') review++;
    totalRouted++;
  }

  console.log(`[route-items] Routed ${totalRouted} items`);
  await logIngestEvent({
    workflowRunId,
    step: 'route',
    level: 'success',
    message: `Routed ${totalRouted} scored items with ${controller.publishingGateMode} publishing gate.`,
    metrics: {
      routed: totalRouted,
      approved,
      rejected,
      review,
      gateMode: controller.publishingGateMode,
      autoApproveThreshold: controller.autoApproveThreshold,
      autoRejectThreshold: controller.autoRejectThreshold,
      maxAutoApprovedPerRun: controller.maxAutoApprovedPerRun,
    },
  });
  return totalRouted;
}
