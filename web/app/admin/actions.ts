'use server';

import { revalidatePath, updateTag } from 'next/cache';
import { redirect } from 'next/navigation';
import { start } from 'workflow/api';
import { createServiceClient } from '@/lib/supabase/server';
import { checkAuth } from '@/lib/auth/admin';
import { ingestWorkflow, type IngestPhases } from '@/lib/workflow/ingest';
import { peopleStatsWorkflow } from '@/lib/workflow/people-stats';
import { logIngestEvent } from '@/lib/workflow/events';
import { pruneIngestEventsByAge, pruneIngestEventsOldest } from '@/lib/workflow/metrics-rollup';
import { setLogRetentionDays } from '@/lib/setup/state';
import {
  enumerateProviderModels,
  normalizeProvider,
  type AiModelOption,
} from '@/lib/ai/provider-config';
import {
  DEFAULT_FRONT_PAGE_CONTROLLER,
  DEFAULT_FRONT_PAGE_PROMPT,
  DEFAULT_FRONT_PAGE_SECTIONS,
  DEFAULT_QUALITY_DIMENSIONS,
  DEFAULT_QUALITY_MANAGER_PROMPT,
  normalizeController,
  normalizeFrontPageSections,
  normalizeQualityDimensions,
} from '@/lib/front-page/controller';

function parseJsonConfig(configStr: string | null): Record<string, unknown> {
  if (!configStr?.trim()) return {};
  try {
    const parsed = JSON.parse(configStr);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function deriveFeedConfig(type: string, url: string, config: Record<string, unknown>) {
  if (type === 'twitter' && !config.handle) {
    const handle = url
      .replace(/^https?:\/\/(www\.)?(x|twitter)\.com\//i, '')
      .split(/[/?#]/)[0]
      .replace('@', '');
    if (handle) return { ...config, handle };
  }

  if (type === 'youtube') {
    return {
      maxResults: 10,
      scrapeIdeas: true,
      ...config,
    };
  }

  if (type === 'linkedin') {
    return {
      maxPosts: 10,
      cadenceHours: 12,
      ...config,
    };
  }

  return config;
}

async function requireAdmin() {
  if (!(await checkAuth())) {
    throw new Error('Unauthorized');
  }
}

async function createAdminServiceClient() {
  await requireAdmin();
  return createServiceClient();
}

// News items
function invalidateNewsSurfaces() {
  updateTag('news');
  updateTag('front-page');
  revalidatePath('/');
}

function redirectAiProvidersError(error: unknown): never {
  const message = error instanceof Error ? error.message : 'Provider update failed.';
  redirect(`/admin/ai-providers?error=${encodeURIComponent(message)}`);
}

async function readProviderSecret(provider: string, secretId: string) {
  const supabase = await createAdminServiceClient();
  const { data, error } = await supabase.rpc('aitea_read_ai_provider_secret', {
    secret_id: secretId,
  });

  if (error) throw new Error(`Could not read ${provider} key from Vault: ${error.message}`);
  if (typeof data !== 'string' || !data.trim()) throw new Error(`${provider} key is not available in Vault.`);
  return data;
}

async function saveProviderCatalog(
  provider: string,
  models: AiModelOption[],
  updates: { vaultSecretId?: string; selectedModel?: string | null } = {}
) {
  const supabase = await createAdminServiceClient();
  const now = new Date().toISOString();
  const { error } = await supabase
    .from('aitea_ai_provider_configs')
    .upsert(
      {
        provider,
        vault_secret_id: updates.vaultSecretId,
        selected_model: updates.selectedModel,
        model_catalog: models,
        last_checked_at: now,
        updated_at: now,
      },
      { onConflict: 'provider' }
    );

  if (error) throw new Error(`Could not save ${provider} model catalog: ${error.message}`);
}

export async function saveAiProviderKey(formData: FormData) {
  const provider = normalizeProvider(formData.get('provider'));
  const apiKey = String(formData.get('apiKey') ?? '').trim();

  if (!provider) redirectAiProvidersError(new Error('Choose a supported provider.'));
  if (!apiKey) redirectAiProvidersError(new Error('Paste an API key before saving.'));

  try {
    const supabase = await createAdminServiceClient();
    const { data: existing, error: readError } = await supabase
      .from('aitea_ai_provider_configs')
      .select('vault_secret_id, selected_model')
      .eq('provider', provider)
      .maybeSingle();

    if (readError) throw new Error(`Could not read ${provider} settings: ${readError.message}`);

    const models = await enumerateProviderModels(provider, apiKey);
    if (models.length === 0) throw new Error(`${provider} did not return any models for this key.`);

    const { data: secretId, error: secretError } = await supabase.rpc('aitea_save_ai_provider_secret', {
      provider_name: provider,
      secret_value: apiKey,
      existing_secret_id: existing?.vault_secret_id ?? null,
    });

    if (secretError) throw new Error(`Could not store ${provider} key in Vault: ${secretError.message}`);
    if (typeof secretId !== 'string') throw new Error('Vault did not return a secret id.');

    const selectedModel =
      typeof existing?.selected_model === 'string' &&
      models.some((model) => model.gatewayModelId === existing.selected_model)
        ? existing.selected_model
        : models[0]?.gatewayModelId ?? null;

    await saveProviderCatalog(provider, models, { vaultSecretId: secretId, selectedModel });
  } catch (error) {
    redirectAiProvidersError(error);
  }

  revalidatePath('/admin/ai-providers');
  redirect('/admin/ai-providers?saved=1');
}

export async function refreshAiProviderModels(provider: string) {
  const normalized = normalizeProvider(provider);
  if (!normalized) redirectAiProvidersError(new Error('Choose a supported provider.'));

  try {
    const supabase = await createAdminServiceClient();
    const { data: config, error } = await supabase
      .from('aitea_ai_provider_configs')
      .select('vault_secret_id, selected_model')
      .eq('provider', normalized)
      .maybeSingle();

    if (error) throw new Error(`Could not read ${normalized} settings: ${error.message}`);
    if (!config?.vault_secret_id) throw new Error(`Store a ${normalized} key before refreshing models.`);

    const secret = await readProviderSecret(normalized, config.vault_secret_id);
    const models = await enumerateProviderModels(normalized, secret);
    if (models.length === 0) throw new Error(`${normalized} did not return any models for this key.`);

    const selectedModel =
      typeof config.selected_model === 'string' &&
      models.some((model) => model.gatewayModelId === config.selected_model)
        ? config.selected_model
        : models[0]?.gatewayModelId ?? null;

    await saveProviderCatalog(normalized, models, {
      vaultSecretId: config.vault_secret_id,
      selectedModel,
    });
  } catch (error) {
    redirectAiProvidersError(error);
  }

  revalidatePath('/admin/ai-providers');
  redirect('/admin/ai-providers?saved=1');
}

export async function selectAiProviderModel(formData: FormData) {
  const provider = normalizeProvider(formData.get('provider'));
  const model = String(formData.get('model') ?? '').trim();

  if (!provider) redirectAiProvidersError(new Error('Choose a supported provider.'));
  if (!model) redirectAiProvidersError(new Error('Choose a model.'));

  try {
    const supabase = await createAdminServiceClient();
    const { data: config, error: readError } = await supabase
      .from('aitea_ai_provider_configs')
      .select('model_catalog')
      .eq('provider', provider)
      .maybeSingle();

    if (readError) throw new Error(`Could not read ${provider} models: ${readError.message}`);

    const models = Array.isArray(config?.model_catalog) ? (config.model_catalog as AiModelOption[]) : [];
    if (!models.some((entry) => entry.gatewayModelId === model)) {
      throw new Error('Refresh this provider before selecting that model.');
    }

    const now = new Date().toISOString();
    const { error: clearError } = await supabase
      .from('aitea_ai_provider_configs')
      .update({ active_for_scoring: false, updated_at: now })
      .neq('provider', provider);
    if (clearError) throw new Error(`Could not clear prior active model: ${clearError.message}`);

    const { error: updateError } = await supabase
      .from('aitea_ai_provider_configs')
      .update({
        selected_model: model,
        active_for_scoring: true,
        updated_at: now,
      })
      .eq('provider', provider);

    if (updateError) throw new Error(`Could not activate ${model}: ${updateError.message}`);
  } catch (error) {
    redirectAiProvidersError(error);
  }

  revalidatePath('/admin/ai-providers');
  redirect('/admin/ai-providers?saved=1');
}

export async function approveItem(id: string) {
  const supabase = await createAdminServiceClient();
  await supabase
    .from('aitea_news_items')
    .update({ status: 'approved', reviewed_at: new Date().toISOString(), archived_at: null })
    .eq('id', id);
  invalidateNewsSurfaces();
  revalidatePath('/admin/queue');
  revalidatePath('/admin/rejected');
}

export async function rejectItem(id: string) {
  const supabase = await createAdminServiceClient();
  await supabase
    .from('aitea_news_items')
    .update({ status: 'rejected', reviewed_at: new Date().toISOString() })
    .eq('id', id);
  invalidateNewsSurfaces();
  revalidatePath('/admin/queue');
}

export async function promoteItem(id: string) {
  const supabase = await createAdminServiceClient();
  await supabase
    .from('aitea_news_items')
    .update({ status: 'pending', reviewed_at: null, archived_at: null })
    .eq('id', id);
  invalidateNewsSurfaces();
  revalidatePath('/admin/rejected');
  revalidatePath('/admin/queue');
}

export async function batchApprove(minScore: number) {
  const supabase = await createAdminServiceClient();
  const { error } = await supabase
    .from('aitea_news_items')
    .update({ status: 'approved', reviewed_at: new Date().toISOString() })
    .eq('status', 'pending')
    .gte('score', minScore);
  if (error) console.error('[batchApprove] Error:', error.message);
  invalidateNewsSurfaces();
  revalidatePath('/admin/queue');
  revalidatePath('/admin/dashboard');
}

export async function approveAll() {
  const supabase = await createAdminServiceClient();
  const { error } = await supabase
    .from('aitea_news_items')
    .update({ status: 'approved', reviewed_at: new Date().toISOString() })
    .eq('status', 'pending')
    .not('score', 'is', null);
  if (error) console.error('[approveAll] Error:', error.message);
  invalidateNewsSurfaces();
  revalidatePath('/admin/queue');
  revalidatePath('/admin/dashboard');
}

export async function rejectAll() {
  const supabase = await createAdminServiceClient();
  const { error } = await supabase
    .from('aitea_news_items')
    .update({ status: 'rejected', reviewed_at: new Date().toISOString() })
    .eq('status', 'pending')
    .not('score', 'is', null);
  if (error) console.error('[rejectAll] Error:', error.message);
  invalidateNewsSurfaces();
  revalidatePath('/admin/queue');
  revalidatePath('/admin/dashboard');
}

export async function approveSelected(formData: FormData) {
  const ids = formData.getAll('itemIds').map(String).filter(Boolean);
  if (ids.length === 0) return;

  const supabase = await createAdminServiceClient();
  const { error } = await supabase
    .from('aitea_news_items')
    .update({ status: 'approved', reviewed_at: new Date().toISOString() })
    .in('id', ids);

  if (error) console.error('[approveSelected] Error:', error.message);
  invalidateNewsSurfaces();
  revalidatePath('/admin/approvals');
  revalidatePath('/admin/queue');
  revalidatePath('/admin/dashboard');
}

export async function rejectSelected(formData: FormData) {
  const ids = formData.getAll('itemIds').map(String).filter(Boolean);
  if (ids.length === 0) return;

  const supabase = await createAdminServiceClient();
  const { error } = await supabase
    .from('aitea_news_items')
    .update({ status: 'rejected', reviewed_at: new Date().toISOString() })
    .in('id', ids);

  if (error) console.error('[rejectSelected] Error:', error.message);
  invalidateNewsSurfaces();
  revalidatePath('/admin/approvals');
  revalidatePath('/admin/queue');
  revalidatePath('/admin/dashboard');
}

// Soft-removes the selected items from the active queue. The rows stay in the
// database with archived_at set, so they remain available for analytics on what
// was rejected or never used.
export async function discardSelected(formData: FormData) {
  const ids = formData.getAll('itemIds').map(String).filter(Boolean);
  if (ids.length === 0) return;

  const supabase = await createAdminServiceClient();
  const { error } = await supabase
    .from('aitea_news_items')
    .update({ archived_at: new Date().toISOString() })
    .in('id', ids)
    .is('archived_at', null);

  if (error) console.error('[discardSelected] Error:', error.message);
  invalidateNewsSurfaces();
  revalidatePath('/admin/queue');
  revalidatePath('/admin/dashboard');
}

// Feeds
export async function createFeed(formData: FormData) {
  const supabase = await createAdminServiceClient();
  const type = formData.get('type') as string;
  const name = formData.get('name') as string;
  const url = formData.get('url') as string;

  // YouTube / X / LinkedIn require Apify. Reject them when no token is set.
  if (['youtube', 'twitter', 'linkedin'].includes(type) && !process.env.APIFY_API_TOKEN) {
    redirect(`/admin/feeds?error=${encodeURIComponent(`${type} sources require APIFY_API_TOKEN`)}`);
  }

  const configStr = formData.get('config') as string | null;
  const config = deriveFeedConfig(type, url, parseJsonConfig(configStr));

  const { error } = await supabase.from('aitea_feeds').insert({
    type,
    name,
    url,
    config,
  });

  if (error) {
    console.error('[createFeed] Error:', error.message);
    redirect(`/admin/feeds?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath('/admin/feeds');
  revalidatePath('/admin/ingestion');
  redirect('/admin/feeds');
}

export async function toggleFeed(id: string, active: boolean) {
  const supabase = await createAdminServiceClient();
  await supabase.from('aitea_feeds').update({ active }).eq('id', id);
  revalidatePath('/admin/feeds');
  revalidatePath('/admin/ingestion');
}

export async function deleteFeed(id: string) {
  const supabase = await createAdminServiceClient();
  await supabase.from('aitea_feeds').delete().eq('id', id);
  revalidatePath('/admin/feeds');
  revalidatePath('/admin/ingestion');
}

export async function testApifyConnection() {
  await requireAdmin();

  const token = process.env.APIFY_API_TOKEN;
  if (!token) {
    return {
      ok: false,
      message: 'APIFY_API_TOKEN is not visible to this runtime.',
    };
  }

  try {
    const res = await fetch(`https://api.apify.com/v2/users/me?token=${token}`, {
      cache: 'no-store',
    });
    if (!res.ok) {
      return {
        ok: false,
        message: `Apify returned HTTP ${res.status}. Rotate or re-check the Vercel env var.`,
      };
    }

    const data = await res.json();
    return {
      ok: true,
      message: `Connected to Apify as ${data?.data?.username ?? data?.data?.email ?? 'configured user'}.`,
    };
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : 'Apify connection failed.',
    };
  }
}

// People
export async function createPerson(formData: FormData) {
  const supabase = await createAdminServiceClient();
  const handle = formData.get('handle') as string;
  const sources = formData.getAll('sources') as string[];
  const urlField = formData.get('url') as string;

  // Auto-resolve avatar from handle
  const avatarUrl = handle
    ? `https://unavatar.io/x/${handle.replace('@', '')}`
    : null;

  // Auto-set profile URL if not provided
  const profileUrl = urlField || (handle ? `https://x.com/${handle.replace('@', '')}` : null);

  await supabase.from('aitea_people').insert({
    name: formData.get('name') as string,
    handle: handle.replace('@', ''),
    description: formData.get('description') as string,
    tags: (formData.get('tags') as string).split(',').map((t) => t.trim()).filter(Boolean),
    sources,
    avatar_url: avatarUrl,
    url: profileUrl,
  });
  updateTag('people');
  revalidatePath('/admin/people');
}

export async function togglePerson(id: string, active: boolean) {
  const supabase = await createAdminServiceClient();
  await supabase.from('aitea_people').update({ active }).eq('id', id);
  updateTag('people');
  revalidatePath('/admin/people');
}

export async function deletePerson(id: string) {
  const supabase = await createAdminServiceClient();
  await supabase.from('aitea_people').delete().eq('id', id);
  updateTag('people');
  revalidatePath('/admin/people');
}

// Knowledge blocks
const FRONT_PAGE_KNOWLEDGE_CATEGORIES = new Set([
  'front_page_controller',
  'front_page_sections',
  'quality_manager_scorecard',
]);

export async function updateKnowledgeBlock(id: string, contentJson: string) {
  const supabase = await createAdminServiceClient();

  const { data: block } = await supabase
    .from('aitea_knowledge_blocks')
    .select('category')
    .eq('id', id)
    .maybeSingle();

  await supabase
    .from('aitea_knowledge_blocks')
    .update({
      content_json: JSON.parse(contentJson),
      updated_at: new Date().toISOString(),
    })
    .eq('id', id);

  updateTag('knowledge');
  revalidatePath('/admin/knowledge');

  if (block?.category && FRONT_PAGE_KNOWLEDGE_CATEGORIES.has(block.category)) {
    updateTag('front-page');
    revalidatePath('/');
    revalidatePath('/admin/controller');
  }
}

export async function saveFrontPageController(formData: FormData) {
  const supabase = await createAdminServiceClient();
  const settings = normalizeController({
    visible: formData.get('visible') === 'on',
    aiUpdatesEnabled: formData.get('aiUpdatesEnabled') === 'on',
    previewEnabled: formData.get('previewEnabled') === 'on',
    scheduleEvery: Number(formData.get('scheduleEvery') ?? DEFAULT_FRONT_PAGE_CONTROLLER.scheduleEvery),
    scheduleUnit: formData.get('scheduleUnit') as string,
    scheduleMode: formData.get('scheduleMode') as string,
    scheduleTimezone: (formData.get('scheduleTimezone') as string) || DEFAULT_FRONT_PAGE_CONTROLLER.scheduleTimezone,
    businessStartHour: Number(formData.get('businessStartHour') ?? DEFAULT_FRONT_PAGE_CONTROLLER.businessStartHour),
    businessEndHour: Number(formData.get('businessEndHour') ?? DEFAULT_FRONT_PAGE_CONTROLLER.businessEndHour),
    weekdayEveryHours: Number(formData.get('weekdayEveryHours') ?? DEFAULT_FRONT_PAGE_CONTROLLER.weekdayEveryHours),
    weekendEveryHours: Number(formData.get('weekendEveryHours') ?? DEFAULT_FRONT_PAGE_CONTROLLER.weekendEveryHours),
    articleCount: Number(formData.get('articleCount') ?? DEFAULT_FRONT_PAGE_CONTROLLER.articleCount),
    scoreLimitPerRun: Number(formData.get('scoreLimitPerRun') ?? DEFAULT_FRONT_PAGE_CONTROLLER.scoreLimitPerRun),
    promptType: formData.get('promptType') as string,
    qualityPromptType: formData.get('qualityPromptType') as string,
    publishingGateMode: formData.get('publishingGateMode') as string,
    autoApproveThreshold: Number(formData.get('autoApproveThreshold') ?? DEFAULT_FRONT_PAGE_CONTROLLER.autoApproveThreshold),
    autoRejectThreshold: Number(formData.get('autoRejectThreshold') ?? DEFAULT_FRONT_PAGE_CONTROLLER.autoRejectThreshold),
    maxAutoApprovedPerRun: Number(formData.get('maxAutoApprovedPerRun') ?? DEFAULT_FRONT_PAGE_CONTROLLER.maxAutoApprovedPerRun),
    rejectedRetentionDays: Number(formData.get('rejectedRetentionDays') ?? DEFAULT_FRONT_PAGE_CONTROLLER.rejectedRetentionDays),
  });

  await supabase
    .from('aitea_knowledge_blocks')
    .upsert(
      {
        category: 'front_page_controller',
        title: 'Front Page Controller',
        content_json: settings,
        sort_order: 0,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'category' }
    );

  updateTag('front-page');
  revalidatePath('/');
  revalidatePath('/1');
  revalidatePath('/report');
  revalidatePath('/admin/controller');
}

export async function createPromptVersion(formData: FormData) {
  const supabase = await createAdminServiceClient();
  const type = String(formData.get('type') ?? '').trim();
  const content = String(formData.get('content') ?? '').trim();
  if (!type || !content) return;

  const { data: latest } = await supabase
    .from('aitea_prompts')
    .select('version')
    .eq('type', type)
    .order('version', { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextVersion = Number(latest?.version ?? 0) + 1;

  await supabase
    .from('aitea_prompts')
    .update({ active: false })
    .eq('type', type);

  await supabase.from('aitea_prompts').insert({
    type,
    version: nextVersion,
    content,
    active: true,
  });

  revalidatePath('/admin/controller');
  revalidatePath('/admin/prompts');
}

export async function activatePromptVersion(id: string, type: string) {
  const supabase = await createAdminServiceClient();
  await supabase.from('aitea_prompts').update({ active: false }).eq('type', type);
  await supabase.from('aitea_prompts').update({ active: true }).eq('id', id);
  revalidatePath('/admin/controller');
  revalidatePath('/admin/prompts');
}

export async function saveQualityDimensions(formData: FormData) {
  const supabase = await createAdminServiceClient();
  const dimensions = DEFAULT_QUALITY_DIMENSIONS.map((dimension) => ({
    ...dimension,
    weight: Number(formData.get(`${dimension.key}-weight`) ?? dimension.weight),
    description: String(formData.get(`${dimension.key}-description`) ?? dimension.description),
  }));

  const normalized = normalizeQualityDimensions(dimensions);

  await supabase
    .from('aitea_knowledge_blocks')
    .upsert(
      {
        category: 'quality_manager_scorecard',
        title: 'Quality Manager Scorecard',
        content_json: normalized,
        sort_order: 1,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'category' }
    );

  revalidatePath('/admin/controller');
}

export async function saveFrontPageSections(formData: FormData) {
  const supabase = await createAdminServiceClient();
  const sections = normalizeFrontPageSections(
    DEFAULT_FRONT_PAGE_SECTIONS.map((section) => ({
      key: section.key,
      currentSurface: formData.get(`${section.key}-currentSurface`) ?? section.currentSurface,
      liveSource: formData.get(`${section.key}-liveSource`) ?? section.liveSource,
      visible: formData.get(`${section.key}-visible`) === 'on',
      aiUpdatesEnabled: formData.get(`${section.key}-aiUpdatesEnabled`) === 'on',
      scheduleEvery: Number(formData.get(`${section.key}-scheduleEvery`) ?? section.scheduleEvery),
      scheduleUnit: formData.get(`${section.key}-scheduleUnit`) ?? section.scheduleUnit,
      articleCount: Number(formData.get(`${section.key}-articleCount`) ?? section.articleCount),
      prompt: formData.get(`${section.key}-prompt`) ?? section.prompt,
    }))
  );

  await supabase
    .from('aitea_knowledge_blocks')
    .upsert(
      {
        category: 'front_page_sections',
        title: 'Front Page Section Controls',
        content_json: sections,
        sort_order: 2,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'category' }
    );

  updateTag('front-page');
  revalidatePath('/');
  revalidatePath('/1');
  revalidatePath('/admin/controller');
}

export async function resetFrontPageController() {
  const supabase = await createAdminServiceClient();
  await supabase
    .from('aitea_knowledge_blocks')
    .upsert(
      {
        category: 'front_page_controller',
        title: 'Front Page Controller',
        content_json: DEFAULT_FRONT_PAGE_CONTROLLER,
        sort_order: 0,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'category' }
    );
  updateTag('front-page');
  revalidatePath('/');
  revalidatePath('/admin/controller');
}

export async function resetFrontPageSections() {
  const supabase = await createAdminServiceClient();
  await supabase
    .from('aitea_knowledge_blocks')
    .upsert(
      {
        category: 'front_page_sections',
        title: 'Front Page Section Controls',
        content_json: DEFAULT_FRONT_PAGE_SECTIONS,
        sort_order: 2,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'category' }
    );
  updateTag('front-page');
  revalidatePath('/');
  revalidatePath('/admin/controller');
}

export async function resetQualityDimensions() {
  const supabase = await createAdminServiceClient();
  await supabase
    .from('aitea_knowledge_blocks')
    .upsert(
      {
        category: 'quality_manager_scorecard',
        title: 'Quality Manager Scorecard',
        content_json: DEFAULT_QUALITY_DIMENSIONS,
        sort_order: 1,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'category' }
    );
  revalidatePath('/admin/controller');
}

async function resetPromptToDefault(type: string, fallback: string) {
  const supabase = await createAdminServiceClient();

  const { data: latest } = await supabase
    .from('aitea_prompts')
    .select('version')
    .eq('type', type)
    .order('version', { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextVersion = Number(latest?.version ?? 0) + 1;

  await supabase.from('aitea_prompts').update({ active: false }).eq('type', type);
  await supabase.from('aitea_prompts').insert({
    type,
    version: nextVersion,
    content: fallback,
    active: true,
  });

  revalidatePath('/admin/controller');
  revalidatePath('/admin/prompts');
}

export async function resetEditorialPrompt() {
  await resetPromptToDefault('front_page_generation', DEFAULT_FRONT_PAGE_PROMPT);
}

export async function resetQualityManagerPrompt() {
  await resetPromptToDefault('quality_manager', DEFAULT_QUALITY_MANAGER_PROMPT);
}

function parseManualIngestPhases(formData?: FormData): IngestPhases {
  if (!formData || formData.get('phasePicker') !== '1') {
    return { fetch: true, score: true, route: true, images: true };
  }

  const phases = {
    fetch: formData.get('fetch') === 'on',
    score: formData.get('score') === 'on',
    route: formData.get('route') === 'on',
    images: formData.get('images') === 'on',
  };

  if (!phases.fetch && !phases.score && !phases.route && !phases.images) {
    return { fetch: false, score: true, route: true, images: false };
  }

  return phases;
}

async function startManualPipelineRun(formData?: FormData) {
  const supabase = await createAdminServiceClient();
  const phases = parseManualIngestPhases(formData);
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
    .select('id, workflow_run_id, status')
    .eq('status', 'running')
    .is('completed_at', null)
    .gte('started_at', recentRunningCutoff)
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (activeRun) {
    return {
      ok: true,
      alreadyRunning: true,
      controlRunId: activeRun.workflow_run_id as string | null,
      workflowRunId: null,
      phases,
    };
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
          updatedAt: new Date().toISOString(),
        },
        sort_order: 3,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'category' }
    );

  const run = await start(ingestWorkflow, [controlRunId, phases]);
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
          updatedAt: new Date().toISOString(),
        },
        sort_order: 3,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'category' }
    );

  return {
    ok: true,
    alreadyRunning: false,
    controlRunId,
    workflowRunId: run.runId,
    phases,
  };
}

export async function startManualPipelineRunWithProgress(formData: FormData) {
  const result = await startManualPipelineRun(formData);
  revalidatePath('/admin/operations');
  revalidatePath('/admin/operations/surveillance');
  revalidatePath('/admin/queue');
  revalidatePath('/admin/ingestion');
  revalidatePath('/admin/dashboard');
  return result;
}

export async function startManualIngest(formData?: FormData) {
  await startManualPipelineRun(formData);
  revalidatePath('/admin/operations');
  revalidatePath('/admin/operations/surveillance');
  revalidatePath('/admin/queue');
  revalidatePath('/admin/ingestion');
  revalidatePath('/admin/dashboard');
}

export async function requestStopIngest() {
  const supabase = await createAdminServiceClient();
  await supabase
    .from('aitea_knowledge_blocks')
    .upsert(
      {
        category: 'ingest_control',
        title: 'Ingest Control',
        content_json: {
          stopRequested: true,
          updatedAt: new Date().toISOString(),
        },
        sort_order: 3,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'category' }
    );

  await supabase
    .from('aitea_workflow_runs')
    .update({
      errors: [{ source: 'controller', message: 'Stop requested from admin operations.' }],
    })
    .eq('status', 'running')
    .is('completed_at', null);

  await logIngestEvent({
    step: 'stop',
    level: 'warning',
    message: 'Stop scans requested from admin operations.',
  });

  revalidatePath('/admin/operations');
  revalidatePath('/admin/operations/surveillance');
  revalidatePath('/admin/dashboard');
}

export async function setLogRetention(formData: FormData) {
  await requireAdmin();
  const days = Number(formData.get('logRetentionDays') ?? 0);
  await setLogRetentionDays(Number.isFinite(days) ? days : 0);
  revalidatePath('/admin/operations');
}

export async function pruneLogsByAge(formData: FormData) {
  await requireAdmin();
  const days = Number(formData.get('olderThanDays') ?? 0);
  await pruneIngestEventsByAge(days);
  revalidatePath('/admin/operations');
  revalidatePath('/admin/operations/surveillance');
}

export async function pruneLogsByCount(formData: FormData) {
  await requireAdmin();
  const n = Number(formData.get('deleteOldest') ?? 0);
  await pruneIngestEventsOldest(n);
  revalidatePath('/admin/operations');
  revalidatePath('/admin/operations/surveillance');
}

export async function startManualPeopleStats() {
  await requireAdmin();

  await start(peopleStatsWorkflow);
  revalidatePath('/admin/operations');
  revalidatePath('/admin/ingestion');
  revalidatePath('/admin/dashboard');
}
