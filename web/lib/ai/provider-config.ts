import type { SupabaseClient } from '@supabase/supabase-js';

export type AiProvider = 'openai' | 'anthropic' | 'deepseek';

export type AiModelOption = {
  id: string;
  name: string;
  gatewayModelId: string;
};

export type AiProviderConfig = {
  provider: AiProvider;
  vault_secret_id: string | null;
  selected_model: string | null;
  active_for_scoring: boolean;
  model_catalog: AiModelOption[];
  last_checked_at: string | null;
  updated_at: string;
};

export const AI_PROVIDERS: Array<{ id: AiProvider; label: string; keyHint: string }> = [
  { id: 'openai', label: 'OpenAI', keyHint: 'sk-...' },
  { id: 'anthropic', label: 'Anthropic', keyHint: 'sk-ant-...' },
  { id: 'deepseek', label: 'DeepSeek', keyHint: 'sk-...' },
];

const MODEL_PREFIX: Record<AiProvider, string> = {
  openai: 'openai/',
  anthropic: 'anthropic/',
  deepseek: 'deepseek/',
};

export function toGatewayModelId(provider: AiProvider, modelId: string) {
  if (modelId.includes('/')) return modelId;

  if (provider === 'anthropic') {
    return `${MODEL_PREFIX[provider]}${modelId.replace(/^(claude-(?:haiku|sonnet|opus)-\d)-(\d)(.*)$/i, '$1.$2$3')}`;
  }

  return `${MODEL_PREFIX[provider]}${modelId}`;
}

export function normalizeProvider(value: FormDataEntryValue | string | null): AiProvider | null {
  if (value === 'openai' || value === 'anthropic' || value === 'deepseek') return value;
  return null;
}

export function normalizeModelCatalog(provider: AiProvider, value: unknown): AiModelOption[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const candidate = item as Partial<AiModelOption>;
      if (!candidate.id || typeof candidate.id !== 'string') return null;

      return {
        id: candidate.id,
        name: typeof candidate.name === 'string' && candidate.name ? candidate.name : candidate.id,
        gatewayModelId:
          typeof candidate.gatewayModelId === 'string' && candidate.gatewayModelId
            ? candidate.gatewayModelId
            : toGatewayModelId(provider, candidate.id),
      };
    })
    .filter((item): item is AiModelOption => Boolean(item));
}

export async function getActiveScoringModel(supabase: SupabaseClient) {
  const { data, error } = await supabase
    .from('aitea_ai_provider_configs')
    .select('selected_model')
    .eq('active_for_scoring', true)
    .not('selected_model', 'is', null)
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('[ai-provider-config] Failed to load active scoring model:', error.message);
    return null;
  }

  return typeof data?.selected_model === 'string' ? data.selected_model : null;
}

export async function enumerateProviderModels(provider: AiProvider, apiKey: string): Promise<AiModelOption[]> {
  const key = apiKey.trim();
  if (!key) throw new Error('API key is required.');

  if (provider === 'anthropic') return enumerateAnthropicModels(key);
  if (provider === 'deepseek') return enumerateOpenAiCompatibleModels(provider, 'https://api.deepseek.com/models', key);
  return enumerateOpenAiCompatibleModels(provider, 'https://api.openai.com/v1/models', key);
}

async function enumerateOpenAiCompatibleModels(provider: AiProvider, url: string, apiKey: string) {
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${apiKey}` },
    cache: 'no-store',
  });

  const payload = await readJson(response);
  if (!response.ok) {
    throw new Error(extractProviderError(payload, `${provider} returned HTTP ${response.status}.`));
  }

  const rows = getPayloadRows(payload);
  return rows
    .map((row) => (typeof row.id === 'string' ? row.id : null))
    .filter((id): id is string => Boolean(id))
    .sort((a, b) => a.localeCompare(b))
    .map((id) => ({ id, name: id, gatewayModelId: toGatewayModelId(provider, id) }));
}

async function enumerateAnthropicModels(apiKey: string) {
  const response = await fetch('https://api.anthropic.com/v1/models', {
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    cache: 'no-store',
  });

  const payload = await readJson(response);
  if (!response.ok) {
    throw new Error(extractProviderError(payload, `Anthropic returned HTTP ${response.status}.`));
  }

  const rows = getPayloadRows(payload);
  return rows
    .map((row) => {
      const id = typeof row.id === 'string' ? row.id : null;
      if (!id) return null;
      return {
        id,
        name: typeof row.display_name === 'string' ? row.display_name : id,
        gatewayModelId: toGatewayModelId('anthropic', id),
      };
    })
    .filter((item): item is AiModelOption => Boolean(item))
    .sort((a, b) => a.name.localeCompare(b.name));
}

function getPayloadRows(payload: unknown): Array<Record<string, unknown>> {
  if (!payload || typeof payload !== 'object') return [];
  const data = (payload as { data?: unknown }).data;
  return Array.isArray(data) ? data.filter((row): row is Record<string, unknown> => Boolean(row) && typeof row === 'object') : [];
}

async function readJson(response: Response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function extractProviderError(payload: unknown, fallback: string) {
  if (payload && typeof payload === 'object') {
    const maybe = payload as { error?: { message?: unknown }; message?: unknown };
    if (typeof maybe.error?.message === 'string') return maybe.error.message;
    if (typeof maybe.message === 'string') return maybe.message;
  }
  return fallback;
}
