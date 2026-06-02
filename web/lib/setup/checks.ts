import { readFile } from 'fs/promises';
import path from 'path';
import { createServiceClient } from '@/lib/supabase/server';
import { hasAnyAdminPassword } from '@/lib/auth/admin';

export type CheckStatus = 'ok' | 'warn' | 'fail';
export type CheckResult = {
  id: string;
  label: string;
  status: CheckStatus;
  detail: string;
};
export type CheckGroup = {
  title: string;
  results: CheckResult[];
};

// Every aitea_ table the app expects to exist.
export const EXPECTED_TABLES = [
  'aitea_news_items',
  'aitea_feeds',
  'aitea_knowledge_blocks',
  'aitea_people',
  'aitea_prompts',
  'aitea_workflow_runs',
  'aitea_ingest_events',
  'aitea_ai_provider_configs',
  'aitea_people_stats',
  'aitea_activity_log',
  'aitea_daily_metrics',
  'aitea_app_config',
] as const;

function ok(id: string, label: string, detail: string): CheckResult {
  return { id, label, status: 'ok', detail };
}
function warn(id: string, label: string, detail: string): CheckResult {
  return { id, label, status: 'warn', detail };
}
function fail(id: string, label: string, detail: string): CheckResult {
  return { id, label, status: 'fail', detail };
}

export async function checkEnvironment(): Promise<CheckResult[]> {
  const results: CheckResult[] = [];

  results.push(
    process.env.NEXT_PUBLIC_SUPABASE_URL
      ? ok('env-url', 'Supabase URL', 'NEXT_PUBLIC_SUPABASE_URL is set')
      : fail('env-url', 'Supabase URL', 'NEXT_PUBLIC_SUPABASE_URL is missing')
  );
  results.push(
    process.env.SUPABASE_SERVICE_ROLE_KEY
      ? ok('env-service', 'Service-role key', 'SUPABASE_SERVICE_ROLE_KEY is set')
      : fail('env-service', 'Service-role key', 'SUPABASE_SERVICE_ROLE_KEY is missing')
  );
  results.push(
    process.env.ADMIN_JWT_SECRET
      ? ok('env-jwt', 'Admin session secret', 'ADMIN_JWT_SECRET is set')
      : fail('env-jwt', 'Admin session secret', 'ADMIN_JWT_SECRET is missing — admin login cannot issue cookies')
  );

  const hasPassword = await hasAnyAdminPassword();
  results.push(
    hasPassword
      ? ok('env-pass', 'Admin password', 'Configured (env or /setup)')
      : warn('env-pass', 'Admin password', 'No password set — complete /setup or set ADMIN_PASS')
  );

  return results;
}

export async function checkDatabase(): Promise<{ connected: boolean; results: CheckResult[] }> {
  const results: CheckResult[] = [];
  let supabase;
  try {
    supabase = createServiceClient();
  } catch (e) {
    results.push(fail('db-conn', 'Database connection', (e as Error).message));
    return { connected: false, results };
  }

  const missing: string[] = [];
  await Promise.all(
    EXPECTED_TABLES.map(async (table) => {
      const { error } = await supabase
        .from(table)
        .select('*', { count: 'exact', head: true });
      if (error) missing.push(table);
    })
  );

  if (missing.length === EXPECTED_TABLES.length) {
    results.push(
      fail('db-conn', 'Database connection', 'Could not reach the database or no tables exist — apply schema.sql')
    );
    return { connected: false, results };
  }

  results.push(ok('db-conn', 'Database connection', 'Connected via service role'));

  if (missing.length === 0) {
    results.push(ok('db-tables', 'Schema', `All ${EXPECTED_TABLES.length} aitea_ tables present`));
  } else {
    results.push(
      fail('db-tables', 'Schema', `Missing ${missing.length} table(s): ${missing.join(', ')} — re-run schema.sql`)
    );
  }

  return { connected: true, results };
}

export async function checkContentSeed(): Promise<CheckResult[]> {
  const results: CheckResult[] = [];
  let supabase;
  try {
    supabase = createServiceClient();
  } catch {
    return results;
  }

  const counts = await Promise.all(
    (['aitea_feeds', 'aitea_people', 'aitea_knowledge_blocks', 'aitea_prompts'] as const).map(
      async (table) => {
        const { count } = await supabase.from(table).select('*', { count: 'exact', head: true });
        return { table, count: count ?? 0 };
      }
    )
  );

  for (const { table, count } of counts) {
    const label = table.replace('aitea_', '');
    results.push(
      count > 0
        ? ok(`seed-${label}`, `Seed: ${label}`, `${count} row(s)`)
        : warn(`seed-${label}`, `Seed: ${label}`, 'Empty — run seed.sql for starter content')
    );
  }

  const { count: activePrompt } = await supabase
    .from('aitea_prompts')
    .select('*', { count: 'exact', head: true })
    .eq('active', true);
  results.push(
    (activePrompt ?? 0) > 0
      ? ok('seed-active-prompt', 'Active scoring prompt', 'One active prompt found')
      : fail('seed-active-prompt', 'Active scoring prompt', 'No active prompt — scoring will fail')
  );

  return results;
}

export async function checkAutomation(): Promise<CheckResult[]> {
  const results: CheckResult[] = [];

  // Cron config — read vercel.json if we can reach it.
  try {
    const raw = await readFile(path.join(process.cwd(), 'vercel.json'), 'utf8');
    const parsed = JSON.parse(raw) as { crons?: Array<{ path: string; schedule: string }> };
    const crons = parsed.crons ?? [];
    results.push(
      crons.length > 0
        ? ok('cron', 'Cron jobs', `${crons.length} configured: ${crons.map((c) => c.path).join(', ')}`)
        : warn('cron', 'Cron jobs', 'No crons found in vercel.json')
    );
  } catch {
    results.push(
      warn('cron', 'Cron jobs', 'Could not read vercel.json at runtime — verify crons in the Vercel dashboard')
    );
  }

  results.push(
    process.env.CRON_SECRET
      ? ok('cron-secret', 'Cron secret', 'CRON_SECRET is set')
      : warn('cron-secret', 'Cron secret', 'CRON_SECRET not set — cron calls are unauthenticated')
  );

  // Has the pipeline ever run?
  try {
    const supabase = createServiceClient();
    const { count } = await supabase
      .from('aitea_workflow_runs')
      .select('*', { count: 'exact', head: true });
    results.push(
      (count ?? 0) > 0
        ? ok('workflow', 'Ingest workflow', `${count} run(s) recorded`)
        : warn('workflow', 'Ingest workflow', 'No runs yet — trigger POST /api/workflows/ingest')
    );
  } catch {
    results.push(warn('workflow', 'Ingest workflow', 'Could not read workflow runs'));
  }

  return results;
}

export async function checkAi(): Promise<CheckResult[]> {
  const results: CheckResult[] = [];

  if (process.env.ANTHROPIC_API_KEY) {
    results.push(ok('ai-key', 'AI scoring key', 'ANTHROPIC_API_KEY is set'));
    return results;
  }

  try {
    const supabase = createServiceClient();
    const { data } = await supabase
      .from('aitea_ai_provider_configs')
      .select('provider, active_for_scoring, vault_secret_id')
      .eq('active_for_scoring', true)
      .not('vault_secret_id', 'is', null)
      .maybeSingle();
    results.push(
      data
        ? ok('ai-key', 'AI scoring key', `Provider "${data.provider}" configured via /admin/ai-providers`)
        : warn('ai-key', 'AI scoring key', 'No provider configured — set ANTHROPIC_API_KEY or use /admin/ai-providers')
    );
  } catch {
    results.push(warn('ai-key', 'AI scoring key', 'No AI provider configured'));
  }

  return results;
}

/** Full health snapshot for /admin/health. */
export async function runAllChecks(): Promise<CheckGroup[]> {
  const [env, db, seed, automation, ai] = await Promise.all([
    checkEnvironment(),
    checkDatabase().then((r) => r.results),
    checkContentSeed(),
    checkAutomation(),
    checkAi(),
  ]);

  return [
    { title: 'Environment', results: env },
    { title: 'Database', results: db },
    { title: 'Content & seed', results: seed },
    { title: 'Automation', results: automation },
    { title: 'AI scoring', results: ai },
  ];
}
