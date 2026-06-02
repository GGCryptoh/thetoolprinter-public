import { createServiceClient } from '@/lib/supabase/server';

// App-level state lives in the aitea_app_config key/value table.
const SETUP_KEY = 'setup';
const ADMIN_AUTH_KEY = 'admin_auth';

type SetupValue = { complete?: boolean; completed_at?: string };
export type AdminAuthValue = {
  hash?: string;
  salt?: string;
  algo?: string;
  updated_at?: string;
};

async function readConfig<T>(key: string): Promise<T | null> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('aitea_app_config')
    .select('value')
    .eq('key', key)
    .maybeSingle();
  if (error || !data) return null;
  return (data.value ?? null) as T | null;
}

async function writeConfig(key: string, value: unknown): Promise<void> {
  const supabase = createServiceClient();
  const { error } = await supabase
    .from('aitea_app_config')
    .upsert(
      { key, value: value as Record<string, unknown>, updated_at: new Date().toISOString() },
      { onConflict: 'key' }
    );
  if (error) throw new Error(`Failed to write app config "${key}": ${error.message}`);
}

/** True once the first-run /setup wizard has been completed. */
export async function isSetupComplete(): Promise<boolean> {
  try {
    const value = await readConfig<SetupValue>(SETUP_KEY);
    return Boolean(value?.complete);
  } catch {
    // If the table/DB isn't reachable, setup is definitionally not complete.
    return false;
  }
}

export async function markSetupComplete(): Promise<void> {
  await writeConfig(SETUP_KEY, { complete: true, completed_at: new Date().toISOString() });
}

const LOG_RETENTION_KEY = 'log_retention';

/** Days of ingest-event logs to keep. 0 = keep everything (no auto-prune). */
export async function getLogRetentionDays(): Promise<number> {
  try {
    const value = await readConfig<{ days?: number }>(LOG_RETENTION_KEY);
    const n = Number(value?.days);
    return Number.isFinite(n) && n >= 0 ? n : 0;
  } catch {
    return 0;
  }
}

export async function setLogRetentionDays(days: number): Promise<void> {
  const safe = Number.isFinite(days) && days >= 0 ? Math.floor(days) : 0;
  await writeConfig(LOG_RETENTION_KEY, { days: safe });
}

export async function getStoredAdminAuth(): Promise<AdminAuthValue | null> {
  try {
    return await readConfig<AdminAuthValue>(ADMIN_AUTH_KEY);
  } catch {
    return null;
  }
}

export async function storeAdminAuth(auth: AdminAuthValue): Promise<void> {
  await writeConfig(ADMIN_AUTH_KEY, { ...auth, updated_at: new Date().toISOString() });
}
