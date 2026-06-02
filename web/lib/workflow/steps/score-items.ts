import { generateText, Output } from 'ai';
import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import { createServiceClient } from '@/lib/supabase/server';
import { estimateModelCost } from '@/lib/financials/model-costs';
import type { NewsItem } from '@/lib/supabase/types';
import { countWords, logIngestEvent } from '@/lib/workflow/events';
import { computeWeightedScore } from '@/lib/front-page/score';
import type { AiProvider } from '@/lib/ai/provider-config';

// A score dimension. The active prompt only asks the model for a subset of the
// 11 weighted dimensions, so the rest arrive missing/malformed. Defaulting them
// to a constant dragged every weighted score toward the middle (scores were
// stuck near 5 and could never reach the publish gate). Instead, absent or
// malformed dimensions become null and are skipped when re-normalizing the
// weighted score, which restores the full 1-10 range. A stray field still never
// fails the whole batch.
const dimensionScore = z.number().min(0).max(10).nullable().catch(null);

const ScoredItemSchema = z.object({
  relevance: dimensionScore,
  recency: dimensionScore,
  novelty: dimensionScore,
  impact: dimensionScore,
  evidence: dimensionScore,
  governanceFit: dimensionScore,
  operatorUsefulness: dimensionScore,
  sourceQuality: dimensionScore,
  clarity: dimensionScore,
  distinctiveness: dimensionScore,
  riskAwareness: dimensionScore,
  overall: dimensionScore,
  qualityReason: z.string().catch(''),
  tags: z.array(z.string()).catch([]),
  summary: z.string().catch(''),
});

const ScoringResultSchema = z.object({
  results: z.array(ScoredItemSchema),
});

type ScoringConfig = {
  provider: AiProvider | null;
  model: string;
  vaultSecretId: string | null;
};

type ScoringCallResult = {
  output: z.infer<typeof ScoringResultSchema> | null;
  usage: {
    inputTokens?: number | null;
    outputTokens?: number | null;
    totalTokens?: number | null;
  };
  runtime: 'anthropic-direct' | 'vercel-ai-gateway';
  model: string;
};

export async function scoreNewItems(limit = 50, promptType = 'quality_manager', workflowRunId?: string): Promise<number> {
  "use step";

  console.log('[score-items] Starting scoring step');
  const supabase = createServiceClient();

  const { data: items, error } = await supabase
    .from('aitea_news_items')
    .select('*')
    .is('score', null)
    .eq('status', 'pending')
    .is('archived_at', null)
    .order('created_at', { ascending: true })
    .limit(limit);

  if (error || !items || items.length === 0) {
    console.log('[score-items] No items to score');
    await logIngestEvent({
      workflowRunId,
      step: 'score',
      message: 'Quality Manager found no unscored pending items.',
      metrics: { limit, promptType },
    });
    return 0;
  }

  console.log(`[score-items] Found ${items.length} items to score`);
  await logIngestEvent({
    workflowRunId,
    step: 'score',
    message: `Quality Manager preparing ${items.length} items.`,
    metrics: {
      limit,
      promptType,
      items: items.length,
      words: items.reduce((sum, item) => sum + countWords(item.title, item.summary), 0),
    },
  });

  const { data: promptRow } = await supabase
    .from('aitea_prompts')
    .select('content')
    .in('type', [promptType, 'scoring'])
    .eq('active', true)
    .order('version', { ascending: false })
    .limit(1)
    .single();

  const promptTemplate = promptRow?.content ?? getDefaultPrompt();

  const batchSize = 10;
  let totalScored = 0;
  let failedBatches = 0;
  const scoringConfig = await getScoringConfig(supabase);

  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize) as NewsItem[];

    const itemsText = batch
      .map(
        (item, idx) => {
          const meta = item.raw_metadata as Record<string, unknown> | null;
          const pubDate = meta?.pub_date ?? meta?.published_at ?? meta?.created_at ?? null;
          return `${idx + 1}. Title: ${item.title}\n   Source: ${item.source_type} / ${item.source_name ?? 'unknown'}\n   Published: ${pubDate ?? 'unknown'}\n   Description: ${item.summary ?? 'N/A'}\n   URL: ${item.url}`;
        }
      )
      .join('\n\n');

    const today = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    const prompt = promptTemplate
      .replace('{{date}}', today)
      .replace('{{items}}', itemsText);

    try {
      console.log(`[score-items] Scoring batch ${i / batchSize + 1} (${batch.length} items)`);
      await logIngestEvent({
        workflowRunId,
        step: 'score:batch',
        message: `Scoring batch ${i / batchSize + 1} with ${batch.length} items.`,
        metrics: {
          batch: i / batchSize + 1,
          batchSize: batch.length,
          model: scoringConfig.model,
          provider: scoringConfig.provider,
          words: batch.reduce((sum, item) => sum + countWords(item.title, item.summary), 0),
        },
      });

      const result = await scoreBatch(prompt, scoringConfig, supabase);

      const cost = estimateModelCost(result.model, result.usage);
      await logIngestEvent({
        workflowRunId,
        step: 'score:usage',
        message: `Recorded model usage for scoring batch ${i / batchSize + 1}.`,
        metrics: {
          batch: i / batchSize + 1,
          batchSize: batch.length,
          model: cost.model,
          inputTokens: cost.inputTokens,
          outputTokens: cost.outputTokens,
          totalTokens: cost.totalTokens,
          estimatedCostUsd: cost.estimatedCostUsd,
          pricingSource: cost.pricingSource,
          pricingBasis: cost.pricingBasis,
          actualUsage: true,
          runtime: result.runtime,
        },
      });

      const scored = result.output;
      if (!scored) {
        console.error(`[score-items] No output from scoring batch ${i / batchSize + 1}`);
        await logIngestEvent({
          workflowRunId,
          step: 'score:error',
          level: 'error',
          message: `Quality Manager returned no output for batch ${i / batchSize + 1}.`,
          metrics: { batch: i / batchSize + 1 },
        });
        continue;
      }

      for (let j = 0; j < batch.length && j < scored.results.length; j++) {
        const score = scored.results[j];
        const item = batch[j];

        // Recency is objective; the model frequently omits it or guesses low,
        // which capped weighted scores and starved the publish gate. Derive it
        // from the real publish date instead, falling back to the model value.
        const recencyScore = deterministicRecency(item) ?? score.recency;

        // novelty/impact/relevance are required by the breakdown type and the
        // prompt always returns them; guard the rare null with 0.
        const breakdown: NonNullable<NewsItem['score_breakdown']> = {
          novelty: score.novelty ?? 0,
          impact: score.impact ?? 0,
          relevance: score.relevance ?? 0,
          qualityReason: score.qualityReason,
        };
        if (typeof score.overall === 'number') breakdown.qualityScore = score.overall;

        // Only store optional dimensions the model actually returned, so the
        // weighted score re-normalizes over present dimensions and keeps the
        // full range instead of regressing toward a default for the omitted ones.
        if (typeof recencyScore === 'number') breakdown.recency = recencyScore;
        if (typeof score.evidence === 'number') breakdown.evidence = score.evidence;
        if (typeof score.governanceFit === 'number') breakdown.governanceFit = score.governanceFit;
        if (typeof score.operatorUsefulness === 'number') breakdown.operatorUsefulness = score.operatorUsefulness;
        if (typeof score.sourceQuality === 'number') breakdown.sourceQuality = score.sourceQuality;
        if (typeof score.clarity === 'number') breakdown.clarity = score.clarity;
        if (typeof score.distinctiveness === 'number') breakdown.distinctiveness = score.distinctiveness;
        if (typeof score.riskAwareness === 'number') breakdown.riskAwareness = score.riskAwareness;

        const weighted = computeWeightedScore(breakdown);
        const finalScore = weighted ?? score.overall ?? 0;
        const rounded = Math.round(finalScore * 100) / 100;

        await supabase
          .from('aitea_news_items')
          .update({
            score: rounded,
            score_breakdown: breakdown,
            tags: score.tags,
            summary: score.summary,
            scored_at: new Date().toISOString(),
          })
          .eq('id', item.id);

        totalScored++;
        await logIngestEvent({
          workflowRunId,
          step: 'score:item',
          level: rounded >= 7 ? 'success' : 'info',
          message: `${item.title} scored ${rounded}.`,
          sourceType: item.source_type,
          sourceName: item.source_name,
          itemId: item.id,
          metrics: {
            score: rounded,
            modelOverall: score.overall,
            relevance: score.relevance,
            recency: recencyScore,
            governanceFit: score.governanceFit,
            operatorUsefulness: score.operatorUsefulness,
            words: countWords(item.title, item.summary, score.summary),
            reason: score.qualityReason,
          },
        });
      }
    } catch (err) {
      failedBatches++;
      console.error(`[score-items] Batch failed (items ${i}-${i + batchSize}):`, err);
      await logIngestEvent({
        workflowRunId,
        step: 'score:error',
        level: 'error',
        message: `Quality Manager batch ${i / batchSize + 1} failed.`,
        metrics: { batch: i / batchSize + 1, error: String(err) },
      });
    }
  }

  console.log(`[score-items] Scored ${totalScored} items`);
  if (totalScored === 0 && failedBatches > 0) {
    throw new Error(`Quality Manager failed to score ${failedBatches} batch(es) with model ${scoringConfig.model}.`);
  }

  await logIngestEvent({
    workflowRunId,
    step: 'score',
    level: 'success',
    message: `Quality Manager scored ${totalScored} items.`,
    metrics: { scored: totalScored },
  });
  return totalScored;
}

async function getScoringConfig(supabase: ReturnType<typeof createServiceClient>): Promise<ScoringConfig> {
  const fallback = process.env.AITEA_SCORING_MODEL ?? 'anthropic/claude-sonnet-4.6';
  const { data, error } = await supabase
    .from('aitea_ai_provider_configs')
    .select('provider, selected_model, vault_secret_id')
    .eq('active_for_scoring', true)
    .not('selected_model', 'is', null)
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('[score-items] Failed to load active scoring config:', error.message);
    return { provider: null, model: fallback, vaultSecretId: null };
  }

  return {
    provider: isAiProvider(data?.provider) ? data.provider : null,
    model: typeof data?.selected_model === 'string' ? data.selected_model : fallback,
    vaultSecretId: typeof data?.vault_secret_id === 'string' ? data.vault_secret_id : null,
  };
}

async function scoreBatch(
  prompt: string,
  config: ScoringConfig,
  supabase: ReturnType<typeof createServiceClient>
): Promise<ScoringCallResult> {
  const apiKey =
    config.provider === 'anthropic' && config.vaultSecretId
      ? await readVaultSecret(supabase, config.vaultSecretId)
      : null;

  const resolvedAnthropicApiKey = apiKey ?? process.env.ANTHROPIC_API_KEY;

  if (config.provider === 'anthropic' && resolvedAnthropicApiKey) {
    const model = toAnthropicApiModel(config.model);
    const anthropic = new Anthropic({
      apiKey: resolvedAnthropicApiKey,
    });

    const response = await anthropic.messages.create({
      model,
      max_tokens: 4000,
      temperature: 0,
      system: 'Return only valid JSON matching the requested schema. Do not wrap the JSON in Markdown.',
      messages: [{ role: 'user', content: prompt }],
    });

    const text = response.content
      .map((block) => (block.type === 'text' ? block.text : ''))
      .join('\n')
      .trim();

    return {
      output: ScoringResultSchema.parse(parseJsonText(text)),
      usage: {
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
        totalTokens: response.usage.input_tokens + response.usage.output_tokens,
      },
      runtime: 'anthropic-direct',
      model,
    };
  }

  const result = await generateText({
    model: config.model,
    output: Output.object({ schema: ScoringResultSchema }),
    prompt,
    providerOptions: {
      gateway: {
        tags: ['feature:news-scoring', 'source:pipeline'],
      },
    },
  });

  return {
    output: result.output,
    usage: result.usage,
    runtime: 'vercel-ai-gateway',
    model: config.model,
  };
}

async function readVaultSecret(supabase: ReturnType<typeof createServiceClient>, secretId: string) {
  const { data, error } = await supabase.rpc('aitea_read_ai_provider_secret', {
    secret_id: secretId,
  });

  if (error) throw new Error(`Could not read Anthropic key from Vault: ${error.message}`);
  if (typeof data !== 'string' || !data.trim()) throw new Error('Anthropic key is missing from Vault.');
  return data;
}

function toAnthropicApiModel(model: string) {
  const withoutPrefix = model.replace(/^anthropic\//, '');
  const knownGatewayIds: Record<string, string> = {
    'claude-sonnet-4.6': 'claude-sonnet-4-20250514',
    'claude-sonnet-4-6': 'claude-sonnet-4-20250514',
    'claude-sonnet-4': 'claude-sonnet-4-20250514',
    'claude-opus-4.1': 'claude-opus-4-1-20250805',
    'claude-opus-4-1': 'claude-opus-4-1-20250805',
    'claude-opus-4': 'claude-opus-4-20250514',
  };

  if (knownGatewayIds[withoutPrefix]) return knownGatewayIds[withoutPrefix];
  return withoutPrefix.replace(/^(claude-(?:haiku|sonnet|opus)-\d)\.(\d)(.*)$/i, '$1-$2$3');
}

function parseJsonText(text: string) {
  try {
    return JSON.parse(text);
  } catch {
    const match = text.match(/```(?:json)?\s*([\s\S]*?)```/) ?? text.match(/(\{[\s\S]*\})/);
    if (!match?.[1]) throw new Error('Anthropic returned non-JSON scoring output.');
    return JSON.parse(match[1]);
  }
}

function isAiProvider(value: unknown): value is AiProvider {
  return value === 'openai' || value === 'anthropic' || value === 'deepseek';
}

// Derive a 0-10 recency score from the item's real publish date so it does not
// depend on the model (which frequently omits it). Returns null when no usable
// timestamp is available, so the caller can fall back to the model's value.
function deterministicRecency(item: NewsItem): number | null {
  const meta = item.raw_metadata as Record<string, unknown> | null;
  const raw =
    (meta?.pub_date as string | undefined) ??
    (meta?.published_at as string | undefined) ??
    (meta?.created_at as string | undefined) ??
    item.created_at ??
    null;
  if (!raw) return null;

  const published = new Date(raw).getTime();
  if (!Number.isFinite(published)) return null;

  const ageHours = (Date.now() - published) / 3_600_000;
  if (ageHours <= 24) return 10;
  if (ageHours <= 48) return 8;
  if (ageHours <= 72) return 6;
  if (ageHours <= 24 * 7) return 4;
  if (ageHours <= 24 * 14) return 2;
  return 1;
}

function getDefaultPrompt(): string {
  return `You are an AI news curator for The Tool Printer. Today is {{date}}.

Score the following items on ten dimensions (0-10 each):
- Relevance: Fit to AI agency, governance, trust, identity, and enterprise operator concerns.
- Recency: Freshness of the source. Heavily penalize items older than 48 hours; items older than a week should score 0-2 unless they are evergreen analysis.
- Novelty: How new or unique is this compared with the normal AI news cycle?
- Impact: How significant is this for the AI field or enterprise adoption?
- Evidence: Does the item include concrete facts, primary sources, dates, named entities, demos, numbers, or technical detail?
- Governance Fit: Does it connect to authority, auditability, liability, provenance, identity, controls, or trust?
- Operator Usefulness: Would this help a builder, consultant, or leader make a better decision?
- Source Quality: Is the source credible and specific enough to support the summary?
- Clarity: Can it be explained without fake certainty or buzzword fog?
- Distinctiveness: Does it avoid sounding like the same generic AI post everyone else is publishing?
- Risk Awareness: Does it surface constraints, failure modes, regulation, or implementation risk?

The overall score should weight novelty heavily — stale news is not valuable regardless of impact. A week-old story about a major launch should still score low overall.

For EACH item, return a JSON object with relevance, recency, novelty, impact, evidence, governanceFit, operatorUsefulness, sourceQuality, clarity, distinctiveness, riskAwareness, overall, qualityReason, tags (array of strings), and summary (one-line).

Return a JSON object with a "results" array, one entry per item, in the same order as the input.

Items:
{{items}}`;
}
