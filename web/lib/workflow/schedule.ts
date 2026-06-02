import { createServiceClient } from '@/lib/supabase/server';
import type { FrontPageController } from '@/lib/front-page/controller';

type ScheduleDecision = {
  shouldStart: boolean;
  reason: string;
  lastRunAt: string | null;
  nextDueAt: string | null;
};

const RECENT_RUNNING_WINDOW_MS = 90 * 60 * 1000;

export function controllerIntervalMs(controller: Pick<FrontPageController, 'scheduleEvery' | 'scheduleUnit'>) {
  const every = Math.max(1, Number(controller.scheduleEvery) || 1);
  const units = {
    hours: 60 * 60 * 1000,
    days: 24 * 60 * 60 * 1000,
    weeks: 7 * 24 * 60 * 60 * 1000,
  } satisfies Record<FrontPageController['scheduleUnit'], number>;

  return every * units[controller.scheduleUnit];
}

// Local wall-clock hour (0-23) and weekend flag in the controller's timezone.
function localParts(now: Date, timezone: string): { hour: number; isWeekend: boolean } {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hour: '2-digit',
      hour12: false,
      weekday: 'short',
    }).formatToParts(now);
    let hour = parseInt(parts.find((p) => p.type === 'hour')?.value ?? '0', 10);
    if (!Number.isFinite(hour) || hour === 24) hour = 0;
    const weekday = parts.find((p) => p.type === 'weekday')?.value ?? '';
    return { hour, isWeekend: weekday === 'Sat' || weekday === 'Sun' };
  } catch {
    // Bad timezone — fall back to UTC and treat as a weekday so we never silently halt.
    return { hour: now.getUTCHours(), isWeekend: false };
  }
}

// Business-hours decision: only inside the daytime window, at the weekday or
// weekend cadence. Returns the effective interval, or null when now is outside
// an allowed window (so the caller skips this tick).
function businessIntervalMs(
  controller: FrontPageController,
  now: Date
): { intervalMs: number | null; reason: string } {
  const { hour, isWeekend } = localParts(now, controller.scheduleTimezone);
  const cadenceHours = isWeekend ? controller.weekendEveryHours : controller.weekdayEveryHours;

  if (isWeekend && cadenceHours <= 0) {
    return { intervalMs: null, reason: 'Weekend runs are disabled in the business-hours schedule.' };
  }
  if (hour < controller.businessStartHour || hour >= controller.businessEndHour) {
    return {
      intervalMs: null,
      reason: `Outside the business window (${controller.businessStartHour}:00–${controller.businessEndHour}:00 ${controller.scheduleTimezone}).`,
    };
  }
  return { intervalMs: Math.max(1, cadenceHours) * 60 * 60 * 1000, reason: '' };
}

export async function shouldStartScheduledIngest(
  controller: FrontPageController,
  now = new Date()
): Promise<ScheduleDecision> {
  if (!controller.aiUpdatesEnabled) {
    return {
      shouldStart: false,
      reason: 'AI updates are disabled in the admin controller.',
      lastRunAt: null,
      nextDueAt: null,
    };
  }

  const supabase = createServiceClient();
  const { data: recentRunning } = await supabase
    .from('aitea_workflow_runs')
    .select('workflow_run_id, started_at')
    .eq('status', 'running')
    .gte('started_at', new Date(now.getTime() - RECENT_RUNNING_WINDOW_MS).toISOString())
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (recentRunning) {
    return {
      shouldStart: false,
      reason: 'A recent ingest workflow is already running.',
      lastRunAt: recentRunning.started_at,
      nextDueAt: null,
    };
  }

  const { data: lastRun } = await supabase
    .from('aitea_workflow_runs')
    .select('started_at, completed_at')
    .not('completed_at', 'is', null)
    .order('completed_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const lastRunAt = lastRun?.completed_at ?? lastRun?.started_at ?? null;

  // Resolve the effective cadence. In business mode the window also gates the
  // run, so we honor it even on the very first run.
  let intervalMs: number;
  if (controller.scheduleMode === 'business') {
    const business = businessIntervalMs(controller, now);
    if (business.intervalMs === null) {
      return { shouldStart: false, reason: business.reason, lastRunAt, nextDueAt: null };
    }
    intervalMs = business.intervalMs;
  } else {
    intervalMs = controllerIntervalMs(controller);
  }

  if (!lastRunAt) {
    return {
      shouldStart: true,
      reason: 'No previous completed ingest run found.',
      lastRunAt: null,
      nextDueAt: null,
    };
  }

  const nextDue = new Date(new Date(lastRunAt).getTime() + intervalMs);
  const shouldStart = now >= nextDue;

  return {
    shouldStart,
    reason: shouldStart
      ? 'Controller cadence is due.'
      : `Controller cadence is not due until ${nextDue.toISOString()}.`,
    lastRunAt,
    nextDueAt: nextDue.toISOString(),
  };
}

